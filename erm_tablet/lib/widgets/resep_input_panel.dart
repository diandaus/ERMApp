import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/resep_ranap_item.dart';
import '../services/api_client.dart';
import '../services/resep_ranap_service.dart';
import '../services/soap_history_service.dart';
import '../services/soap_ralan_service.dart';

const _kBorder = Color(0xFFE5E7EB);
const _kInputBorder = Color(0xFFD1D5DB);
const _kGreen = Color(0xFF059669);

// Default kalau kolomnya dibiarkan kosong (bukan diblok wajib isi) —
// nilai & perilaku PERSIS ResepModal.tsx.
const _kAturanPakaiDefault = '3x1 sehari setelah makan';
const _kRacikanNamaDefault = 'Pulvis';
const _kRacikanAturanPakaiDefault = '3x1 sehari';
const _kMetodeRacik = ['Kapsul', 'Puyer', 'Sirup', 'Salep', 'Krim'];

// Kunci riwayat saran (autocomplete) — nama sama dgn localStorage di
// ResepModal.tsx; disimpan di perangkat lewat SoapHistoryService. Aturan
// Pakai non-racikan & racikan berbagi SATU riwayat, sama dgn web.
const _kHistAturanPakai = 'aturan_pakai_history';
const _kHistNamaRacikan = 'nama_racikan_history';
const _kHistKeterangan = 'keterangan_racikan_history';

/// Kolom teks + saran dari riwayat ketikan: begitu difokuskan muncul isian
/// terakhir, menyempit mengikuti ketikan; ketuk saran utk mengisi kolom.
class _HistoryField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final List<String> history;
  final InputDecoration decoration;
  final TextStyle style;
  final VoidCallback? onTap;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  const _HistoryField({required this.controller, required this.focusNode, required this.history, required this.decoration, required this.style, this.onTap, this.onChanged, this.onSubmitted});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => RawAutocomplete<String>(
        textEditingController: controller,
        focusNode: focusNode,
        optionsBuilder: (value) => SoapHistoryService.suggest(history, value.text),
        onSelected: onChanged,
        fieldViewBuilder: (context, c, focus, _) => TextField(controller: c, focusNode: focus, onTap: onTap, onChanged: onChanged, onSubmitted: onSubmitted, decoration: decoration, style: style),
        optionsViewBuilder: (context, onSelected, options) => Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(4),
            clipBehavior: Clip.antiAlias,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: 200, maxWidth: constraints.maxWidth < 160 ? 160 : constraints.maxWidth),
              child: ListView.separated(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: options.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: _kBorder),
                itemBuilder: (context, i) {
                  final option = options.elementAt(i);
                  return InkWell(
                    onTap: () => onSelected(option),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Text(option, style: const TextStyle(fontSize: 12, color: Color(0xFF111827)), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _fmtNum(num n) => n % 1 == 0 ? n.toInt().toString() : n.toString();
num _round2(num n) => double.parse(n.toStringAsFixed(2));
String _rupiah(num n) => NumberFormat.decimalPattern('id_ID').format(n.round());

/// showResepInputPanel — modal Input Resep Rawat Jalan, geser dari kanan
/// ke kiri selebar 50% layar (sama pola dgn panel Filter & ResepModal.tsx
/// di web). Balikin true kalau resep tersimpan, supaya pemanggil memuat
/// ulang riwayat resep.
Future<bool> showResepInputPanel(
  BuildContext context, {
  required String noRawat,
  required String noRkmMedis,
  required String nmPasien,
  required String umur,
  required String kdDokter,
  // Diisi = mode EDIT: form terisi isi resep ini, dan saat Simpan resep
  // lama dihapus dulu baru dibuat ulang (sama dgn web).
  ResepRanapResult? editResep,
}) async {
  final saved = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Input Resep',
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, _, __) => Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.5,
        heightFactor: 1,
        child: _ResepInputPanel(noRawat: noRawat, noRkmMedis: noRkmMedis, nmPasien: nmPasien, umur: umur, kdDokter: kdDokter, editResep: editResep),
      ),
    ),
    transitionBuilder: (context, anim, __, child) => SlideTransition(
      position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
      child: child,
    ),
  );
  return saved == true;
}

/// Satu obat non-racikan di tabel "Daftar Obat yang Dipilih" — Jumlah &
/// Aturan Pakai diisi lewat modal saat obat dipilih, lalu masih bisa
/// diedit langsung di barisnya (sama dgn web).
class _ResepLine {
  final String kodeBrng;
  final String namaBrng;
  final String kodeSat;
  final num stok;
  final num harga;
  final TextEditingController jml;
  final TextEditingController aturanPakai;
  _ResepLine({required this.kodeBrng, required this.namaBrng, required this.kodeSat, required this.stok, required this.harga, required int jml, required String aturanPakai})
      : jml = TextEditingController(text: '$jml'),
        aturanPakai = TextEditingController(text: aturanPakai);

  // Sama dgn web (parseInt(...) || 1): kosong/tidak valid dianggap 1.
  int get jmlValue {
    final v = int.tryParse(jml.text.trim()) ?? 0;
    return v <= 0 ? 1 : v;
  }

  void dispose() {
    jml.dispose();
    aturanPakai.dispose();
  }
}

class _RacikanDetail {
  final String kodeBrng;
  final String namaBrng;
  final String kodeSat;
  final String kapasitas;
  final String kandungan;
  final num jml;
  // Stok TERKINI — null kalau tidak diketahui (hasil Copy riwayat, atau
  // template sebelum stoknya dicek ulang). Tidak ikut disimpan ke template.
  num? stok;
  _RacikanDetail({required this.kodeBrng, required this.namaBrng, required this.kodeSat, required this.kapasitas, required this.kandungan, required this.jml, this.stok});

  factory _RacikanDetail.fromJson(Map<String, dynamic> json) => _RacikanDetail(
        kodeBrng: json['kode_brng'] as String? ?? '',
        namaBrng: json['nama_brng'] as String? ?? '',
        kodeSat: json['kode_sat'] as String? ?? '',
        kapasitas: '${json['kapasitas'] ?? ''}',
        kandungan: json['kandungan'] as String? ?? '',
        jml: json['jml'] as num? ?? 0,
      );
}

/// Satu baris tabel master racikan + daftar obat penyusunnya.
class _Racikan {
  final nama = TextEditingController();
  final jmlDr = TextEditingController();
  final aturanPakai = TextEditingController();
  final keterangan = TextEditingController();
  // Dibutuhkan kolom ber-saran (RawAutocomplete) di tabel master racikan.
  final namaFocus = FocusNode();
  final aturanPakaiFocus = FocusNode();
  final keteranganFocus = FocusNode();
  String metode = 'Puyer';
  final List<_RacikanDetail> detail = [];

  int get jmlDrValue => int.tryParse(jmlDr.text.trim()) ?? 0;
  String get namaOrDefault => nama.text.trim().isEmpty ? _kRacikanNamaDefault : nama.text.trim();

  void dispose() {
    nama.dispose();
    jmlDr.dispose();
    aturanPakai.dispose();
    keterangan.dispose();
    namaFocus.dispose();
    aturanPakaiFocus.dispose();
    keteranganFocus.dispose();
  }
}

/// _ResepInputPanel — padanan ResepModal.tsx (web) utk Rawat Jalan, pola
/// & alurnya diikuti: header breadcrumb pasien, tab Non Racikan/Racikan,
/// Cari Obat + Total, pilih obat -> modal Jumlah/Aturan Pakai (racikan:
/// Kandungan/Jumlah), tabel Daftar Obat yang Dipilih, tabel master
/// racikan, SATU tombol Simpan utk keduanya. Endpoint SAMA PERSIS dgn web
/// (/api/obat/search, /api/resep/submit, /api/resep/history,
/// /api/resep/racikan-template). Riwayat Resep (Copy ke form) & Template
/// Resep Racikan (Pilih / Jadikan Template) dibuka sbg panel geser dari
/// KIRI, berdampingan dgn panel ini. BELUM dibangun: edit resep & saran
/// Aturan Pakai dari riwayat ketikan.
class _ResepInputPanel extends StatefulWidget {
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String kdDokter;
  final ResepRanapResult? editResep;
  const _ResepInputPanel({required this.noRawat, required this.noRkmMedis, required this.nmPasien, required this.umur, required this.kdDokter, this.editResep});

  @override
  State<_ResepInputPanel> createState() => _ResepInputPanelState();
}

class _ResepInputPanelState extends State<_ResepInputPanel> {
  final _searchCtrl = TextEditingController();
  final _searchFocus = FocusNode();
  Timer? _debounce;
  bool _searching = false;
  String? _searchError;
  List<Map<String, dynamic>>? _results; // null = belum mencari

  int _tab = 0; // 0 = Non Racikan, 1 = Racikan
  final List<_ResepLine> _lines = [];
  // Selalu ada minimal satu racikan (kosong) spt web; obat hasil cari
  // masuk ke racikan yg sedang aktif (baris yg disorot).
  final List<_Racikan> _racikan = [_Racikan()];
  int _activeRacikan = 0;
  String _beratBadan = '';
  Map<String, List<String>> _history = {};
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _prefillEdit();
    _loadBeratBadan();
    SoapHistoryService.loadAll([_kHistAturanPakai, _kHistNamaRacikan, _kHistKeterangan]).then((h) {
      if (mounted) setState(() => _history = h);
    });
    // Fokus ke Cari Obat di tab Racikan: Nama Racikan kosong diisi
    // otomatis "Pulvis" (sama dgn web), tidak diblok minta diisi dulu.
    _searchFocus.addListener(() {
      if (_searchFocus.hasFocus && _tab == 1 && _racikan[_activeRacikan].nama.text.trim().isEmpty) {
        _racikan[_activeRacikan].nama.text = _kRacikanNamaDefault;
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    _searchFocus.dispose();
    for (final l in _lines) {
      l.dispose();
    }
    for (final r in _racikan) {
      r.dispose();
    }
    super.dispose();
  }

  /// Mode edit: isi form dari resep yg diedit (stok/harga tidak ikut —
  /// riwayat tidak membawanya, sama dgn web).
  void _prefillEdit() {
    final edit = widget.editResep;
    if (edit == null) return;
    _lines.addAll(edit.nonRacikan.map((it) => _ResepLine(kodeBrng: it.kodeBrng, namaBrng: it.namaBrng, kodeSat: it.kodeSat, stok: 0, harga: 0, jml: it.jml > 0 ? it.jml.round() : 1, aturanPakai: it.aturanPakai)));
    if (edit.racikan.isEmpty) return;
    for (final r in _racikan) {
      r.dispose();
    }
    _racikan
      ..clear()
      ..addAll(edit.racikan.map((r) {
        final rac = _Racikan()
          ..nama.text = r.namaRacik
          ..jmlDr.text = '${r.jmlDr > 0 ? r.jmlDr.round() : 1}'
          ..aturanPakai.text = r.aturanPakai
          ..keterangan.text = r.keterangan;
        if (r.metodeRacik.isNotEmpty) rac.metode = r.metodeRacik;
        rac.detail.addAll(r.detail.map((d) => _RacikanDetail(kodeBrng: d.kodeBrng, namaBrng: d.namaBrng, kodeSat: d.kodeSat, kapasitas: '', kandungan: d.kandungan, jml: d.jml)));
        return rac;
      }));
    // Resep yg cuma berisi racikan langsung dibuka di tab Racikan.
    if (edit.nonRacikan.isEmpty) _tab = 1;
  }

  /// Berat Badan utk header (bantu cek dosis) — dari SOAP/CPPT kunjungan
  /// ini, entri PALING BARU yg beratnya terisi (endpoint urut lama->baru).
  Future<void> _loadBeratBadan() async {
    try {
      final riwayat = await SoapRalanService.getRiwayat(widget.noRawat);
      final terbaru = riwayat.reversed.where((s) => s.berat.trim().isNotEmpty).firstOrNull;
      if (terbaru != null && mounted) setState(() => _beratBadan = terbaru.berat.trim());
    } catch (_) {/* diam, header tampil tanpa berat badan */}
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    final q = value.trim();
    if (q.isEmpty) {
      setState(() {
        _results = null;
        _searchError = null;
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 400), () => _search(q));
  }

  Future<void> _search(String q) async {
    try {
      final list = await ResepRanapService.searchObatRalan(q, widget.noRawat);
      // Hasil pencarian lama (user sudah mengetik lagi) dibuang.
      if (!mounted || _searchCtrl.text.trim() != q) return;
      setState(() {
        _results = list;
        _searchError = null;
        _searching = false;
      });
    } catch (_) {
      if (!mounted || _searchCtrl.text.trim() != q) return;
      setState(() {
        _results = [];
        _searchError = 'Gagal mencari obat';
        _searching = false;
      });
    }
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchCtrl.clear();
    _results = null;
    _searchError = null;
    _searching = false;
  }

  // Messenger milik panel ini (lihat build) — context State berada DI
  // ATAS-nya, jadi tidak bisa dicari lewat ScaffoldMessenger.of(context).
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  void _toast(String message) {
    _messengerKey.currentState
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  /// Obat dipilih dari hasil cari -> modal kecil (Jumlah + Aturan Pakai
  /// utk non-racikan, Kandungan + Jumlah utk racikan) -> masuk daftar.
  Future<void> _pick(Map<String, dynamic> obat) async {
    final stok = obat['stok'] as num? ?? 0;
    if (stok <= 0) {
      _toast('Stok Obat saat ini tidak tersedia');
      return;
    }
    final kode = obat['kode_brng'] as String? ?? '';
    final nama = obat['nama_brng'] as String? ?? '';
    final kodeSat = obat['kode_sat'] as String? ?? '';
    FocusScope.of(context).unfocus();

    if (_tab == 0) {
      final result = await showDialog<({int jml, String aturanPakai})>(context: context, builder: (_) => _ObatNonRacikanDialog(namaBrng: nama, kodeSat: kodeSat, stok: stok));
      if (result == null || !mounted) return;
      setState(() {
        _lines.add(_ResepLine(kodeBrng: kode, namaBrng: nama, kodeSat: kodeSat, stok: stok, harga: obat['harga'] as num? ?? 0, jml: result.jml, aturanPakai: result.aturanPakai));
        _clearSearch();
        _error = null;
      });
      // Fokus balik ke Cari Obat spy bisa langsung ketik obat berikutnya.
      _searchFocus.requestFocus();
      return;
    }

    final rac = _racikan[_activeRacikan];
    final kapasitas = '${obat['kapasitas'] ?? ''}';
    final result = await showDialog<({String kandungan, num jml})>(
      context: context,
      builder: (_) => _ObatRacikanDialog(namaBrng: nama, kodeSat: kodeSat, stok: stok, kapasitas: kapasitas, jmlDr: rac.jmlDrValue),
    );
    if (result == null || !mounted) return;
    setState(() {
      rac.detail.add(_RacikanDetail(kodeBrng: kode, namaBrng: nama, kodeSat: kodeSat, kapasitas: kapasitas, kandungan: result.kandungan, jml: result.jml, stok: stok));
      _clearSearch();
      _error = null;
    });
  }

  void _tambahRacikan() {
    // Racikan baru di paling atas & langsung aktif (sama dgn web).
    setState(() {
      _racikan.insert(0, _Racikan());
      _activeRacikan = 0;
    });
  }

  void _hapusRacikan(int idx) {
    final rac = _racikan[idx];
    setState(() {
      _racikan.removeAt(idx);
      if (_activeRacikan >= idx && _activeRacikan > 0) _activeRacikan--;
    });
    rac.dispose();
  }

  void _removeLine(_ResepLine line) {
    setState(() => _lines.remove(line));
    line.dispose();
  }

  void _setActiveRacikan(int idx) {
    if (_activeRacikan != idx) setState(() => _activeRacikan = idx);
  }

  /// Riwayat Resep -> Copy: daftar non-racikan & racikan di form DIGANTI
  /// isi resep yg dipilih (padanan copyResepToForm di web).
  Future<void> _openRiwayat() async {
    final resep = await _showLeftPanel<Map<String, dynamic>>(context, _RiwayatResepPanel(noRkmMedis: widget.noRkmMedis, nmPasien: widget.nmPasien));
    if (resep == null || !mounted) return;
    final nonRacikan = (resep['non_racikan'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final racikan = (resep['racikan'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final oldLines = <_ResepLine>[];
    final oldRacikan = <_Racikan>[];
    setState(() {
      if (nonRacikan.isNotEmpty) {
        oldLines.addAll(_lines);
        _lines
          ..clear()
          ..addAll(nonRacikan.map((o) => _ResepLine(
                kodeBrng: o['kode_brng'] as String? ?? '',
                namaBrng: o['nama_brng'] as String? ?? '',
                kodeSat: o['kode_sat'] as String? ?? '',
                stok: o['stok'] as num? ?? 0,
                harga: o['h_jual'] as num? ?? 0,
                jml: (o['jml'] as num? ?? 1).round(),
                aturanPakai: o['aturan_pakai'] as String? ?? '',
              )));
      }
      if (racikan.isNotEmpty) {
        oldRacikan.addAll(_racikan);
        _racikan
          ..clear()
          ..addAll(racikan.map((r) {
            final jmlDr = r['jml_dr'] as num? ?? 0;
            final metode = r['metode_racik'] as String? ?? '';
            final rac = _Racikan()
              ..nama.text = r['nama_racik'] as String? ?? ''
              ..jmlDr.text = '${jmlDr > 0 ? jmlDr.round() : 1}'
              ..aturanPakai.text = r['aturan_pakai'] as String? ?? '';
            if (metode.isNotEmpty) rac.metode = metode;
            rac.detail.addAll((r['detail'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().map(_RacikanDetail.fromJson));
            return rac;
          }));
        _activeRacikan = 0;
      }
      // Racikan diprioritaskan kalau dua-duanya ada (sama dgn web).
      if (racikan.isNotEmpty) {
        _tab = 1;
      } else if (nonRacikan.isNotEmpty) {
        _tab = 0;
      }
      _clearSearch();
      _error = null;
    });
    for (final l in oldLines) {
      l.dispose();
    }
    for (final r in oldRacikan) {
      r.dispose();
    }
  }

  /// Template Resep -> Pilih: racikan AKTIF diisi susunan template, lalu
  /// stok terkini tiap obatnya dicek ulang (bisa sudah berubah sejak
  /// template disimpan) & diperingatkan kalau kurang.
  Future<void> _openTemplate() async {
    final tmpl = await _showLeftPanel<Map<String, dynamic>>(context, _TemplateResepPanel(kdDokter: widget.kdDokter));
    if (tmpl == null || !mounted) return;
    final rac = _racikan[_activeRacikan];
    final detail = (tmpl['detail'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().map(_RacikanDetail.fromJson).toList();
    final metode = tmpl['metode_racik'] as String? ?? '';
    final jmlDr = tmpl['jml_dr'] as num? ?? 0;
    final aturan = tmpl['aturan_pakai'] as String? ?? '';
    final keterangan = tmpl['keterangan'] as String? ?? '';
    setState(() {
      rac.nama.text = tmpl['nama_template'] as String? ?? '';
      if (metode.isNotEmpty) rac.metode = metode;
      if (jmlDr > 0) rac.jmlDr.text = '${jmlDr.round()}';
      if (aturan.isNotEmpty) rac.aturanPakai.text = aturan;
      if (keterangan.isNotEmpty) rac.keterangan.text = keterangan;
      rac.detail
        ..clear()
        ..addAll(detail);
      _error = null;
    });

    final stokList = await Future.wait(detail.map((d) async {
      try {
        final list = await ResepRanapService.searchObatRalan(d.kodeBrng, widget.noRawat);
        return list.where((o) => o['kode_brng'] == d.kodeBrng).map((o) => o['stok'] as num?).firstOrNull;
      } catch (_) {
        return null; // gagal cek stok — baris tetap tanpa info stok
      }
    }));
    if (!mounted) return;
    setState(() {
      for (var i = 0; i < detail.length; i++) {
        detail[i].stok = stokList[i];
      }
    });
    final kurang = detail.where((d) => d.stok != null && d.stok! < d.jml).toList();
    if (kurang.isEmpty) return;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        insetPadding: _panelDialogInsets(ctx),
        title: const Text('Stok Tidak Cukup', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        content: Text(kurang.map((d) => '${d.namaBrng}: butuh ${_fmtNum(d.jml)}, stok tersedia ${_fmtNum(d.stok!)}').join('\n'), style: const TextStyle(fontSize: 13)),
        actions: [TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('OK'))],
      ),
    );
  }

  /// Jadikan Template Resep — simpan susunan racikan aktif sbg template
  /// pribadi dokter peresep.
  Future<void> _simpanTemplate() async {
    final rac = _racikan[_activeRacikan];
    if (rac.detail.isEmpty) return;
    if (widget.kdDokter.isEmpty) {
      _toast('Dokter peresep belum ada — template bersifat pribadi per dokter');
      return;
    }
    final nama = await showDialog<String>(context: context, builder: (_) => _NamaTemplateDialog(initial: rac.nama.text.trim()));
    if (nama == null || !mounted) return;
    try {
      await ResepRanapService.saveRacikanTemplate({
        'nama_template': nama,
        'kd_dokter': widget.kdDokter,
        'metode_racik': rac.metode,
        'jml_dr': rac.jmlDrValue,
        'aturan_pakai': rac.aturanPakai.text.trim(),
        'keterangan': rac.keterangan.text.trim(),
        'detail': rac.detail.map((d) => {'kode_brng': d.kodeBrng, 'nama_brng': d.namaBrng, 'kode_sat': d.kodeSat, 'kapasitas': d.kapasitas, 'kandungan': d.kandungan, 'jml': d.jml}).toList(),
      });
      if (mounted) _toast('Template "$nama" siap dipakai lagi');
    } catch (e) {
      if (mounted) _toast(e is ApiException ? e.message : 'Gagal menyimpan template');
    }
  }

  Future<void> _submit() async {
    final racikanTerisi = _racikan.where((r) => r.detail.isNotEmpty).toList();
    if (_lines.isEmpty && racikanTerisi.isEmpty) {
      setState(() => _error = 'Belum ada obat yang dipilih (non-racikan atau racikan)');
      return;
    }
    // Jumlah Racik/Bungkus WAJIB diisi — tidak ada default yg masuk akal.
    final tanpaJumlah = racikanTerisi.where((r) => r.jmlDrValue <= 0).firstOrNull;
    if (tanpaJumlah != null) {
      setState(() {
        _tab = 1;
        _error = 'Jumlah Racik/Bungkus untuk racikan "${tanpaJumlah.namaOrDefault}" wajib diisi';
      });
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      // Mode edit: hapus resep lama dulu, baru buat yg baru (sama dgn web).
      final edit = widget.editResep;
      if (edit != null) await ResepRanapService.deleteRalan(edit.noResep);
      // Riwayat saran racikan dicatat saat simpan (sama dgn web); Aturan
      // Pakai non-racikan sudah dicatat modal Jumlah/Aturan Pakai-nya.
      for (final r in racikanTerisi) {
        _history[_kHistNamaRacikan] = await SoapHistoryService.add(_kHistNamaRacikan, r.nama.text, _history[_kHistNamaRacikan] ?? const []);
        _history[_kHistKeterangan] = await SoapHistoryService.add(_kHistKeterangan, r.keterangan.text, _history[_kHistKeterangan] ?? const []);
        _history[_kHistAturanPakai] = await SoapHistoryService.add(_kHistAturanPakai, r.aturanPakai.text, _history[_kHistAturanPakai] ?? const []);
      }
      await ResepRanapService.submitRalan(
        noRawat: widget.noRawat,
        kdDokter: widget.kdDokter,
        nonRacikan: _lines.map((l) {
          final aturan = l.aturanPakai.text.trim();
          return {'kode_brng': l.kodeBrng, 'jml': l.jmlValue, 'aturan_pakai': aturan.isEmpty ? _kAturanPakaiDefault : aturan};
        }).toList(),
        racikan: racikanTerisi.map((r) {
          final aturan = r.aturanPakai.text.trim();
          return {
            'nama_racikan': r.namaOrDefault,
            'keterangan': r.keterangan.text.trim(),
            'metode_racik': r.metode,
            'jml_dr': r.jmlDrValue,
            'aturan_pakai': aturan.isEmpty ? _kRacikanAturanPakaiDefault : aturan,
            'detail': r.detail.map((d) => {'kode_brng': d.kodeBrng, 'kandungan': d.kandungan, 'jml': d.jml}).toList(),
          };
        }).toList(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Terjadi kesalahan saat menyimpan resep';
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // ScaffoldMessenger sendiri spy peringatan (mis. stok kosong) tampil
    // DI DALAM panel, bukan di layar belakang yg tertutup barrier.
    return ScaffoldMessenger(
      key: _messengerKey,
      child: Builder(
        builder: (context) => Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(),
                const Divider(height: 1, color: _kBorder),
                Expanded(
                  child: Stack(
                    children: [
                      ListView(
                        // Ruang bawah ekstra di tab Racikan spy baris terakhir
                        // tidak tertutup tombol mengambang Template Resep.
                        padding: EdgeInsets.fromLTRB(20, 20, 20, _tab == 1 ? 64 : 20),
                        children: [
                          _buildTabs(),
                          const SizedBox(height: 16),
                          if (_tab == 0) ..._buildNonRacikan() else ..._buildRacikanTab(),
                        ],
                      ),
                      // Tombol mengambang "Template Resep" — cuma tab Racikan,
                      // tetap di tempat walau isi di atasnya digulir, persis
                      // di atas tombol Riwayat Resep.
                      if (_tab == 1)
                        Positioned(
                          left: 16,
                          bottom: 12,
                          child: Material(
                            color: Colors.white,
                            elevation: 4,
                            child: InkWell(
                              onTap: _openTemplate,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(border: Border.all(color: _kGreen)),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [Icon(Icons.bookmark_border, size: 14, color: _kGreen), SizedBox(width: 6), Text('Template Resep', style: TextStyle(fontSize: 12, color: _kGreen))],
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
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
                  child: Row(
                    children: [
                      ElevatedButton(
                        onPressed: _saving ? null : _openRiwayat,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4B5563), foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14)),
                        child: const Text('Riwayat Resep', style: TextStyle(fontSize: 14)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _saving ? null : _submit,
                          style: ElevatedButton.styleFrom(backgroundColor: _kGreen, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)), padding: const EdgeInsets.symmetric(vertical: 14)),
                          child: Text(_saving ? 'Menyimpan...' : 'Simpan', style: const TextStyle(fontSize: 14)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Header — breadcrumb pasien (No. Rawat | No. RM | Nama | Umur | Berat
  /// Badan) + tombol tutup bulat.
  Widget _buildHeader() {
    final parts = [widget.noRawat, widget.noRkmMedis, widget.nmPasien, widget.umur, if (_beratBadan.isNotEmpty) 'Berat Badan : $_beratBadan kg'].where((v) => v.isNotEmpty).join('  |  ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 12),
      child: Row(
        children: [
          const Icon(Icons.person_outline, size: 16, color: _kGreen),
          const SizedBox(width: 6),
          Expanded(child: Text(parts, style: const TextStyle(fontSize: 12, color: Colors.black))),
          if (widget.editResep != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(6)),
              child: Text('Edit Resep ${widget.editResep!.noResep}', style: const TextStyle(fontSize: 12, color: Color(0xFF92400E))),
            ),
          ],
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
    );
  }

  /// Tab — button group flat (radius 0, nempel) + "+ Tambah Racikan" di
  /// kanan (cuma tab Racikan).
  Widget _buildTabs() {
    Widget tab(int index, String label) {
      final selected = _tab == index;
      return InkWell(
        onTap: () => setState(() {
          _tab = index;
          _clearSearch();
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 8),
          decoration: BoxDecoration(color: selected ? _kGreen : Colors.white, border: Border.all(color: _kGreen)),
          child: Text(label, style: TextStyle(fontSize: 12, color: selected ? Colors.white : _kGreen)),
        ),
      );
    }

    return Row(
      children: [
        tab(0, 'Non Racikan (${_lines.length})'),
        tab(1, 'Racikan (${_racikan.where((r) => r.detail.isNotEmpty).length})'),
        const Spacer(),
        if (_tab == 1)
          InkWell(
            onTap: _tambahRacikan,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              color: Colors.black,
              child: const Text('+ Tambah Racikan', style: TextStyle(fontSize: 12, color: Colors.white)),
            ),
          ),
      ],
    );
  }

  Widget _label(String text) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF374151))));

  InputDecoration _inputDeco({String? hint}) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
        isDense: true,
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: _kInputBorder)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: _kInputBorder)),
      );

  Widget _searchField() {
    return TextField(
      controller: _searchCtrl,
      focusNode: _searchFocus,
      onChanged: _onSearchChanged,
      decoration: _inputDeco(hint: 'Ketik nama obat untuk mencari otomatis...').copyWith(
        prefixIcon: const Icon(Icons.search, size: 16, color: _kGreen),
        prefixIconConstraints: const BoxConstraints(minWidth: 34, minHeight: 34),
        suffixIcon: _searching ? const Padding(padding: EdgeInsets.all(10), child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))) : null,
        suffixIconConstraints: const BoxConstraints(minWidth: 34, minHeight: 34),
      ),
      style: const TextStyle(fontSize: 13),
    );
  }

  // ── Tabel ringan (Row + lebar tetap/flex) dipakai semua tabel panel ini.
  Widget _th(String text, {double? width, int flex = 1, TextAlign align = TextAlign.left}) {
    final t = Text(text, textAlign: align, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)), maxLines: 1, overflow: TextOverflow.ellipsis);
    return width != null ? SizedBox(width: width, child: t) : Expanded(flex: flex, child: t);
  }

  Widget _td(Widget child, {double? width, int flex = 1}) => width != null ? SizedBox(width: width, child: child) : Expanded(flex: flex, child: child);

  Widget _text(String text, {TextAlign align = TextAlign.left, Color color = const Color(0xFF374151), FontWeight weight = FontWeight.w400}) =>
      Text(text, textAlign: align, style: TextStyle(fontSize: 12, color: color, fontWeight: weight));

  Widget _tableHeader(List<Widget> cells) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        decoration: const BoxDecoration(color: Color(0xFFF9FAFB), border: Border(bottom: BorderSide(color: _kBorder))),
        child: Row(children: cells),
      );

  Widget _tableBox(List<Widget> rows) => Container(
        decoration: BoxDecoration(border: Border.all(color: _kBorder)),
        child: Column(children: rows),
      );

  Widget _emptyBox(String title, String subtitle) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kInputBorder), borderRadius: BorderRadius.circular(12)),
        child: Column(
          children: [
            const Icon(Icons.check_circle_outline, size: 32, color: Color(0xFF9CA3AF)),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
            const SizedBox(height: 6),
            Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ],
        ),
      );

  Widget _trashButton(VoidCallback onPressed) => Center(
        child: InkWell(
          onTap: onPressed,
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(4)),
            child: const Icon(Icons.delete_outline, size: 14, color: Colors.white),
          ),
        ),
      );

  /// Hasil pencarian — tabel Kode/Nama/Satuan/Kps/Stok/Harga spt dropdown
  /// web, ditampilkan tepat di bawah kolom Cari Obat.
  Widget _buildResults() {
    final results = _results;
    if (results == null) return const SizedBox.shrink();
    if (results.isEmpty) {
      return Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: const Color(0xFFEFF6FF), border: Border.all(color: const Color(0xFFBFDBFE)), borderRadius: BorderRadius.circular(4)),
        child: Text(_searchError ?? 'Tidak ada obat ditemukan dengan kata kunci "${_searchCtrl.text.trim()}"', style: TextStyle(fontSize: 12, color: _searchError != null ? const Color(0xFFDC2626) : const Color(0xFF1E40AF))),
      );
    }
    return Container(
      margin: const EdgeInsets.only(top: 4),
      constraints: const BoxConstraints(maxHeight: 260),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kInputBorder), boxShadow: const [BoxShadow(color: Color(0x1F000000), blurRadius: 12, offset: Offset(0, 4))]),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _tableHeader([_th('Kode Barang', width: 86), _th('Nama Barang', flex: 1), _th('Satuan', width: 50, align: TextAlign.center), _th('Kps', width: 36, align: TextAlign.center), _th('Stok', width: 50, align: TextAlign.center), _th('Harga (Rp)', width: 76, align: TextAlign.right)]),
          Flexible(
            child: ListView.separated(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              itemCount: results.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: _kBorder),
              itemBuilder: (context, i) {
                final o = results[i];
                final stok = o['stok'] as num? ?? 0;
                final kps = '${o['kapasitas'] ?? ''}';
                final extra = [o['jenis_obat'], o['nama_industri']].where((v) => v != null && '$v'.isNotEmpty).join(' - ');
                return InkWell(
                  onTap: () => _pick(o),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                    child: Row(
                      children: [
                        _td(Text(o['kode_brng'] as String? ?? '', style: const TextStyle(fontSize: 10, color: Color(0xFF374151))), width: 86),
                        _td(
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(o['nama_brng'] as String? ?? '-', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                              if (extra.isNotEmpty) Text(extra, style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280))),
                            ],
                          ),
                        ),
                        _td(_text(o['kode_sat'] as String? ?? '', align: TextAlign.center), width: 50),
                        _td(_text(kps.isEmpty ? '-' : kps, align: TextAlign.center), width: 36),
                        _td(_text(_fmtNum(stok), align: TextAlign.center, color: stok > 0 ? const Color(0xFF16A34A) : const Color(0xFFDC2626)), width: 50),
                        _td(_text(_rupiah(o['harga'] as num? ?? 0), align: TextAlign.right), width: 76),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildNonRacikan() {
    final total = _lines.fold<num>(0, (sum, l) => sum + l.harga * l.jmlValue);
    return [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_label('Cari Obat'), _searchField()])),
          const SizedBox(width: 12),
          SizedBox(
            width: 140,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _label('Total'),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                  decoration: BoxDecoration(color: const Color(0xFFF0FDF4), border: Border.all(color: _kInputBorder), borderRadius: BorderRadius.circular(4)),
                  child: Text('Rp ${_rupiah(total)}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, color: Color(0xFF16A34A))),
                ),
              ],
            ),
          ),
        ],
      ),
      _buildResults(),
      const SizedBox(height: 16),
      _label('Daftar Obat yang Dipilih'),
      if (_lines.isEmpty)
        _emptyBox('Belum Ada Obat Dipilih', 'Cari & pilih obat non-racikan di atas untuk ditambahkan ke resep.')
      else
        _tableBox([
          _tableHeader([_th('No', width: 28, align: TextAlign.center), _th('Nama Obat', flex: 5), _th('Jumlah', width: 64), _th('Satuan', width: 54, align: TextAlign.center), _th('Aturan Pakai', flex: 4), _th('Aksi', width: 40, align: TextAlign.center)]),
          for (var i = 0; i < _lines.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(border: i > 0 ? const Border(top: BorderSide(color: _kBorder)) : null),
              child: Row(
                children: [
                  _td(_text('${i + 1}', align: TextAlign.center), width: 28),
                  _td(Padding(padding: const EdgeInsets.only(right: 8), child: _text(_lines[i].namaBrng)), flex: 5),
                  _td(
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      // onChanged -> setState spy Total ikut berubah.
                      child: TextField(controller: _lines[i].jml, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: _inputDeco(), style: const TextStyle(fontSize: 12)),
                    ),
                    width: 64,
                  ),
                  _td(_text(_lines[i].kodeSat, align: TextAlign.center), width: 54),
                  _td(Padding(padding: const EdgeInsets.only(left: 8), child: TextField(controller: _lines[i].aturanPakai, decoration: _inputDeco(hint: '3x1 sehari'), style: const TextStyle(fontSize: 12))), flex: 4),
                  _td(_trashButton(() => _removeLine(_lines[i])), width: 40),
                ],
              ),
            ),
        ]),
    ];
  }

  List<Widget> _buildRacikanTab() {
    final active = _racikan[_activeRacikan];
    final namaAktif = active.nama.text.trim().isEmpty ? 'Racikan ${_activeRacikan + 1}' : active.nama.text.trim();
    return [
      // Tabel master racikan — ketuk baris/kolomnya utk memilih racikan
      // aktif (disorot biru muda).
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(
          children: [
            _th('No', width: 22),
            _th('Nama Racikan', flex: 4),
            _th('Metode Racik', width: 92),
            _th('Jml.Racik/Bks *', width: 80),
            _th('Aturan Pakai', flex: 4),
            _th('Keterangan', flex: 3),
            _th(_racikan.length > 1 ? 'Aksi' : '', width: _racikan.length > 1 ? 54 : 0, align: TextAlign.center),
          ],
        ),
      ),
      const SizedBox(height: 4),
      for (var i = 0; i < _racikan.length; i++) _buildRacikanRow(i),
      const SizedBox(height: 12),
      const Divider(height: 1, color: _kBorder),
      const SizedBox(height: 12),
      _label('Detail Obat Racikan'),
      _searchField(),
      _buildResults(),
      const SizedBox(height: 16),
      Row(
        children: [
          Expanded(child: _label('Daftar Obat — $namaAktif')),
          if (active.detail.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: InkWell(
                onTap: _simpanTemplate,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kGreen)),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [Icon(Icons.bookmark_border, size: 12, color: _kGreen), SizedBox(width: 5), Text('Jadikan Template Resep', style: TextStyle(fontSize: 11.5, color: _kGreen))],
                  ),
                ),
              ),
            ),
        ],
      ),
      if (active.detail.isEmpty)
        _emptyBox('Belum Ada Obat dalam Racikan', 'Cari & pilih obat di atas untuk ditambahkan ke racikan ini.')
      else
        _tableBox([
          _tableHeader([
            _th('No', width: 28, align: TextAlign.center),
            _th('Nama Obat', flex: 1),
            _th('Kandungan', width: 70, align: TextAlign.center),
            _th('Jumlah', width: 56, align: TextAlign.center),
            _th('Satuan', width: 54, align: TextAlign.center),
            _th('Stok', width: 60, align: TextAlign.center),
            _th('Aksi', width: 40, align: TextAlign.center),
          ]),
          for (var i = 0; i < active.detail.length; i++) _buildDetailRow(active, i),
        ]),
    ];
  }

  Widget _buildRacikanRow(int idx) {
    final rac = _racikan[idx];
    final selected = idx == _activeRacikan;
    void activate() => _setActiveRacikan(idx);
    const style = TextStyle(fontSize: 12);
    Widget pad(Widget child) => Padding(padding: const EdgeInsets.symmetric(horizontal: 3), child: child);
    return GestureDetector(
      onTap: activate,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        color: selected ? const Color(0xFFEFF6FF) : null,
        child: Row(
          children: [
            _td(_text('${idx + 1}'), width: 22),
            // onChanged -> setState spy judul "Daftar Obat — <nama>" ikut.
            _td(pad(_HistoryField(controller: rac.nama, focusNode: rac.namaFocus, history: _history[_kHistNamaRacikan] ?? const [], onTap: activate, onChanged: (_) => setState(() {}), decoration: _inputDeco(hint: _kRacikanNamaDefault), style: style)), flex: 4),
            _td(
              pad(
                DropdownButtonFormField<String>(
                  value: rac.metode,
                  isExpanded: true,
                  isDense: true,
                  decoration: _inputDeco(),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF111827)),
                  items: {..._kMetodeRacik, rac.metode}.map((m) => DropdownMenuItem(value: m, child: Text(m, overflow: TextOverflow.ellipsis))).toList(),
                  onTap: activate,
                  onChanged: (v) => setState(() => rac.metode = v ?? rac.metode),
                ),
              ),
              width: 92,
            ),
            _td(
              pad(TextField(controller: rac.jmlDr, onTap: activate, keyboardType: TextInputType.number, decoration: _inputDeco(hint: '-'), style: TextStyle(fontSize: 12, color: selected ? const Color(0xFF2563EB) : null))),
              width: 80,
            ),
            _td(pad(_HistoryField(controller: rac.aturanPakai, focusNode: rac.aturanPakaiFocus, history: _history[_kHistAturanPakai] ?? const [], onTap: activate, decoration: _inputDeco(hint: _kRacikanAturanPakaiDefault), style: style)), flex: 4),
            _td(pad(_HistoryField(controller: rac.keterangan, focusNode: rac.keteranganFocus, history: _history[_kHistKeterangan] ?? const [], onTap: activate, decoration: _inputDeco(hint: 'Keterangan'), style: style)), flex: 3),
            if (_racikan.length > 1)
              _td(
                Center(
                  child: InkWell(
                    onTap: () => _hapusRacikan(idx),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFDC2626)), borderRadius: BorderRadius.circular(6)),
                      child: const Text('Hapus', style: TextStyle(fontSize: 11, color: Color(0xFFDC2626))),
                    ),
                  ),
                ),
                width: 54,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(_Racikan rac, int i) {
    final d = rac.detail[i];
    // Stok tidak cukup utk jumlah yg dibutuhkan -> baris merah muda + ⚠.
    final stok = d.stok;
    final stokKurang = stok != null && stok < d.jml;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(color: stokKurang ? const Color(0xFFFEF2F2) : null, border: i > 0 ? const Border(top: BorderSide(color: _kBorder)) : null),
      child: Row(
        children: [
          _td(_text('${i + 1}', align: TextAlign.center), width: 28),
          _td(_text(d.namaBrng)),
          _td(_text(d.kandungan, align: TextAlign.center), width: 70),
          _td(_text(_fmtNum(d.jml), align: TextAlign.center), width: 56),
          _td(_text(d.kodeSat, align: TextAlign.center), width: 54),
          _td(_text('${stok == null ? '-' : _fmtNum(stok)}${stokKurang ? ' ⚠' : ''}', align: TextAlign.center, color: stokKurang ? const Color(0xFFDC2626) : const Color(0xFF374151), weight: stokKurang ? FontWeight.w600 : FontWeight.w400), width: 60),
          _td(_trashButton(() => setState(() => rac.detail.removeAt(i))), width: 40),
        ],
      ),
    );
  }
}

// Modal kecil input obat DITENGAHKAN PERSIS DI DALAM panel Resep (separuh
// kanan layar), bukan di tengah layar penuh — sama dgn web. Caranya:
// separuh kiri layar dijadikan inset, lalu dialog ditengahkan di sisanya
// (Alignment saja tidak cukup: pusat dialog ikut bergeser selebar dialog).
EdgeInsets _panelDialogInsets(BuildContext context) => EdgeInsets.fromLTRB(MediaQuery.sizeOf(context).width / 2 + 16, 16, 16, 16);

InputDecoration _dialogDeco({String? hint}) => InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(4)),
    );

Widget _dialogLabel(String text, {bool required = false}) => Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text.rich(
        TextSpan(text: text, children: [if (required) const TextSpan(text: ' *', style: TextStyle(color: Color(0xFFDC2626)))]),
        style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
      ),
    );

Widget _dialogButton(String label, Color color, VoidCallback onPressed) => ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(backgroundColor: color, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13), minimumSize: Size.zero),
      child: Text(label, style: const TextStyle(fontSize: 13)),
    );

/// Modal Input Obat Non Racikan — muncul begitu obat dipilih dari hasil
/// cari: Jumlah (wajib, 1..stok) + Aturan Pakai (kosong -> default
/// "3x1 sehari setelah makan") + Tambah/Batal. Padanan modal yg sama di
/// ResepModal.tsx.
class _ObatNonRacikanDialog extends StatefulWidget {
  final String namaBrng;
  final String kodeSat;
  final num stok;
  const _ObatNonRacikanDialog({required this.namaBrng, required this.kodeSat, required this.stok});

  @override
  State<_ObatNonRacikanDialog> createState() => _ObatNonRacikanDialogState();
}

class _ObatNonRacikanDialogState extends State<_ObatNonRacikanDialog> {
  final _jml = TextEditingController(text: '1');
  final _aturanPakai = TextEditingController();
  final _aturanPakaiFocus = FocusNode();
  List<String> _aturanPakaiHistory = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    // Angka default langsung terblok spy tinggal ketik jumlahnya.
    _jml.selection = TextSelection(baseOffset: 0, extentOffset: _jml.text.length);
    SoapHistoryService.loadAll([_kHistAturanPakai]).then((h) {
      if (mounted) setState(() => _aturanPakaiHistory = h[_kHistAturanPakai] ?? []);
    });
  }

  @override
  void dispose() {
    _jml.dispose();
    _aturanPakai.dispose();
    _aturanPakaiFocus.dispose();
    super.dispose();
  }

  /// Pesan validasi Jumlah — dicek LANGSUNG tiap ketikan, sama dgn web.
  String? _validate(String value) {
    final v = value.trim();
    if (v.isEmpty) return 'Jumlah wajib diisi';
    final jml = int.tryParse(v);
    if (jml == null || jml < 1) return 'Jumlah minimal 1';
    if (jml > widget.stok) return 'Stok obat yang tersedia hanya ${_fmtNum(widget.stok)}';
    return null;
  }

  void _confirm() {
    final error = _validate(_jml.text);
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    final aturan = _aturanPakai.text.trim().isEmpty ? _kAturanPakaiDefault : _aturanPakai.text.trim();
    // Catat ke riwayat saran begitu obat ditambahkan (sama dgn web) —
    // tanpa await, dialog langsung tertutup.
    SoapHistoryService.add(_kHistAturanPakai, aturan, _aturanPakaiHistory);
    Navigator.of(context).pop((jml: int.parse(_jml.text.trim()), aturanPakai: aturan));
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: _panelDialogInsets(context),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.namaBrng, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
              Text('Stok: ${_fmtNum(widget.stok)} ${widget.kodeSat}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  SizedBox(
                    width: 100,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _dialogLabel('Jumlah', required: true),
                        TextField(
                          controller: _jml,
                          autofocus: true,
                          keyboardType: TextInputType.number,
                          onChanged: (v) => setState(() => _error = _validate(v)),
                          onSubmitted: (_) => _confirm(),
                          decoration: _dialogDeco(),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _dialogLabel('Aturan Pakai'),
                        _HistoryField(controller: _aturanPakai, focusNode: _aturanPakaiFocus, history: _aturanPakaiHistory, onSubmitted: (_) => _confirm(), decoration: _dialogDeco(hint: _kAturanPakaiDefault), style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _dialogButton('Tambah', _kGreen, _confirm),
                  const SizedBox(width: 4),
                  _dialogButton('Batal', const Color(0xFF6B7280), () => Navigator.of(context).pop()),
                ],
              ),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))),
            ],
          ),
        ),
      ),
    );
  }
}

/// Modal Input Obat Racikan — padanan modal yg sama di ResepModal.tsx.
/// Dua arah: isi Kandungan -> Jumlah dihitung (kandungan x jml racik /
/// kapasitas, pecahan "2/3" didukung); isi Jumlah -> Kandungan dihitung
/// (jumlah x kapasitas / jml racik).
class _ObatRacikanDialog extends StatefulWidget {
  final String namaBrng;
  final String kodeSat;
  final num stok;
  final String kapasitas;
  final int jmlDr;
  const _ObatRacikanDialog({required this.namaBrng, required this.kodeSat, required this.stok, required this.kapasitas, required this.jmlDr});

  @override
  State<_ObatRacikanDialog> createState() => _ObatRacikanDialogState();
}

class _ObatRacikanDialogState extends State<_ObatRacikanDialog> {
  final _kandungan = TextEditingController();
  final _jml = TextEditingController();
  String? _error;

  double get _kapasitas => double.tryParse(widget.kapasitas) ?? 0;
  double? _parse(String v) => double.tryParse(v.trim().replaceAll(',', '.'));

  @override
  void dispose() {
    _kandungan.dispose();
    _jml.dispose();
    super.dispose();
  }

  void _onKandungan(String value) {
    final v = value.trim();
    if (v.isEmpty) {
      _jml.text = '';
      return;
    }
    double? k;
    if (v.contains('/')) {
      final parts = v.split('/');
      final pembilang = _parse(parts[0]);
      final penyebut = parts.length > 1 ? _parse(parts[1]) : null;
      if (pembilang != null && penyebut != null && penyebut != 0) k = pembilang / penyebut;
    } else {
      k = _parse(v);
    }
    if (k != null && _kapasitas > 0) {
      final jml = _round2(k * widget.jmlDr / _kapasitas);
      _jml.text = jml == 0 ? '' : _fmtNum(jml);
    }
  }

  void _onJml(String value) {
    if (value.trim().isEmpty) {
      _kandungan.text = '';
      return;
    }
    final j = _parse(value);
    if (j != null && _kapasitas > 0 && widget.jmlDr > 0) _kandungan.text = _fmtNum(_round2(j * _kapasitas / widget.jmlDr));
  }

  void _confirm() {
    final jml = _parse(_jml.text) ?? 0;
    if (jml <= 0) {
      setState(() => _error = 'Jumlah belum diisi — isi Kandungan (untuk hitung otomatis) atau isi Jumlah secara langsung.');
      return;
    }
    Navigator.of(context).pop((kandungan: _kandungan.text.trim(), jml: _round2(jml)));
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: _panelDialogInsets(context),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.namaBrng, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
              Text(
                'Stok: ${_fmtNum(widget.stok)} ${widget.kodeSat}${widget.kapasitas.isEmpty ? '' : ' · Kapasitas: ${widget.kapasitas}'}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _dialogLabel('Kandungan'),
                        TextField(controller: _kandungan, autofocus: true, onChanged: _onKandungan, onSubmitted: (_) => _confirm(), decoration: _dialogDeco(hint: '200 atau 2/3'), style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _dialogLabel('Jumlah (${widget.kodeSat.isEmpty ? 'TAB, dst' : widget.kodeSat})'),
                        TextField(
                          controller: _jml,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          onChanged: _onJml,
                          onSubmitted: (_) => _confirm(),
                          decoration: _dialogDeco(hint: '4 / 5 dst'),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _dialogButton('Tambah', _kGreen, _confirm),
                  const SizedBox(width: 4),
                  _dialogButton('Batal', const Color(0xFF6B7280), () => Navigator.of(context).pop()),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Isi salah satu saja — Kandungan untuk hitung Jumlah otomatis, atau Jumlah (mis. 4 tablet) untuk hitung balik Kandungan-nya.',
                style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))),
            ],
          ),
        ),
      ),
    );
  }
}

/// Panel geser dari KIRI selebar 50% layar — berdampingan dgn panel Resep
/// di kanan (barrier transparan spy panel Resep tetap terlihat jelas),
/// dipakai Riwayat Resep & Template Resep. Sama pola dgn web.
Future<T?> _showLeftPanel<T>(BuildContext context, Widget child) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Tutup',
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, _, __) => Align(
      alignment: Alignment.centerLeft,
      child: FractionallySizedBox(widthFactor: 0.5, heightFactor: 1, child: Material(color: Colors.white, elevation: 12, child: SafeArea(child: child))),
    ),
    transitionBuilder: (context, anim, __, child) => SlideTransition(
      position: Tween<Offset>(begin: const Offset(-1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
      child: child,
    ),
  );
}

Widget _leftPanelHeader(BuildContext context, String title) => Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _kBorder))),
      child: Row(
        children: [
          Expanded(child: Text(title, style: const TextStyle(fontSize: 12, color: Colors.black))),
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
    );

Widget _leftPanelEmpty(String title, String subtitle) => Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kInputBorder), borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          const Icon(Icons.check_circle_outline, size: 32, color: Color(0xFF9CA3AF)),
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
        ],
      ),
    );

const _kCellStyle = TextStyle(fontSize: 12, color: Color(0xFF374151));
const _kHeadStyle = TextStyle(fontSize: 11, color: Color(0xFF6B7280));

/// Tabel sederhana bergaris utk panel kiri. [widths]: angka > 0 = lebar
/// tetap, 0 = melebar mengisi sisa.
Widget _gridTable({required List<double> widths, required List<Widget> header, required List<List<Widget>> rows}) {
  return Table(
    border: TableBorder.all(color: _kBorder),
    columnWidths: {for (var i = 0; i < widths.length; i++) i: widths[i] > 0 ? FixedColumnWidth(widths[i]) : const FlexColumnWidth()},
    defaultVerticalAlignment: TableCellVerticalAlignment.middle,
    children: [
      TableRow(decoration: const BoxDecoration(color: Color(0xFFF9FAFB)), children: [for (final h in header) Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5), child: h)]),
      for (final r in rows) TableRow(children: [for (final c in r) Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5), child: c)]),
    ],
  );
}

Widget _panelActionButton(String label, IconData icon, VoidCallback onPressed) => InkWell(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        color: _kGreen,
        child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 13, color: Colors.white), const SizedBox(width: 5), Text(label, style: const TextStyle(fontSize: 11, color: Colors.white))]),
      ),
    );

/// Riwayat Resep pasien (SEMUA kunjungan) — tiap resep: info (No. Resep,
/// No. Rawat, Tanggal, Dokter) + tabel obat/racikan + tombol Copy yg
/// menutup panel & mengembalikan resep itu utk disalin ke form.
class _RiwayatResepPanel extends StatefulWidget {
  final String noRkmMedis;
  final String nmPasien;
  const _RiwayatResepPanel({required this.noRkmMedis, required this.nmPasien});

  @override
  State<_RiwayatResepPanel> createState() => _RiwayatResepPanelState();
}

class _RiwayatResepPanelState extends State<_RiwayatResepPanel> {
  bool _loading = true;
  List<Map<String, dynamic>> _list = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    var list = <Map<String, dynamic>>[];
    try {
      list = await ResepRanapService.getRiwayatRaw(widget.noRkmMedis);
    } catch (_) {/* diam, tampil sbg "Belum Ada Riwayat Resep" */}
    if (!mounted) return;
    setState(() {
      _list = list;
      _loading = false;
    });
  }

  String _tanggal(String tgl) {
    final d = DateTime.tryParse(tgl);
    return d == null ? tgl : DateFormat('dd/MM/yyyy').format(d);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _leftPanelHeader(context, 'Riwayat Resep  |  ${widget.noRkmMedis}  |  ${widget.nmPasien}'),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: _list.isEmpty ? [_leftPanelEmpty('Belum Ada Riwayat Resep', 'Belum ada riwayat resep untuk pasien ini.')] : [for (final r in _list) _buildResep(r)],
                ),
        ),
      ],
    );
  }

  Widget _buildResep(Map<String, dynamic> resep) {
    String s(Map<String, dynamic> m, String key) => '${m[key] ?? ''}';
    Text c(String text, {TextAlign align = TextAlign.left}) => Text(text, textAlign: align, style: _kCellStyle);
    Text h(String text) => Text(text, style: _kHeadStyle);
    final nonRacikan = (resep['non_racikan'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    final racikan = (resep['racikan'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        children: [
          _gridTable(
            widths: const [96, 122, 0, 0, 88],
            header: [h('No. Resep'), h('No. Rawat'), h('Tanggal'), h('Dokter'), Center(child: _panelActionButton('Copy', Icons.copy_outlined, () => Navigator.of(context).pop(resep)))],
            rows: [
              [c(s(resep, 'no_resep')), c(s(resep, 'no_rawat')), c('${_tanggal(s(resep, 'tgl_peresepan'))} ${s(resep, 'jam_peresepan')}'), c(s(resep, 'nm_dokter')), const SizedBox.shrink()],
            ],
          ),
          _gridTable(
            widths: const [30, 84, 0, 56, 56, 110],
            header: [h('No'), h('Kode'), h('Nama Obat / Racikan'), h('Jumlah'), h('Satuan'), h('Aturan Pakai')],
            rows: [
              for (var i = 0; i < nonRacikan.length; i++)
                [c('${i + 1}', align: TextAlign.center), c(s(nonRacikan[i], 'kode_brng')), c(s(nonRacikan[i], 'nama_brng')), c(s(nonRacikan[i], 'jml'), align: TextAlign.center), c(s(nonRacikan[i], 'kode_sat'), align: TextAlign.center), c(s(nonRacikan[i], 'aturan_pakai'))],
              for (final r in racikan) ...[
                [const SizedBox.shrink(), c('No.Racik ${s(r, 'no_racik')}'), c(s(r, 'nama_racik')), c(s(r, 'jml_dr'), align: TextAlign.center), c(s(r, 'metode_racik').isEmpty ? '-' : s(r, 'metode_racik'), align: TextAlign.center), c(s(r, 'aturan_pakai'))],
                for (final d in (r['detail'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>())
                  [const SizedBox.shrink(), c(s(d, 'kode_brng')), Padding(padding: const EdgeInsets.only(left: 16), child: c(s(d, 'nama_brng'))), c(s(d, 'jml'), align: TextAlign.center), c(s(d, 'kode_sat'), align: TextAlign.center), const SizedBox.shrink()],
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// Template Resep Racikan milik dokter peresep (pribadi per dokter) —
/// tiap template: nama/metode/jumlah/aturan pakai + tabel obatnya, tombol
/// Pilih menutup panel & mengembalikan template itu.
class _TemplateResepPanel extends StatefulWidget {
  final String kdDokter;
  const _TemplateResepPanel({required this.kdDokter});

  @override
  State<_TemplateResepPanel> createState() => _TemplateResepPanelState();
}

class _TemplateResepPanelState extends State<_TemplateResepPanel> {
  bool _loading = true;
  List<Map<String, dynamic>> _list = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    var list = <Map<String, dynamic>>[];
    if (widget.kdDokter.isNotEmpty) {
      try {
        list = await ResepRanapService.getRacikanTemplates(widget.kdDokter);
      } catch (_) {/* diam, tampil sbg "Belum Ada Template Resep" */}
    }
    if (!mounted) return;
    setState(() {
      _list = list;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _leftPanelHeader(context, 'Template Resep Racikan'),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: _list.isEmpty
                      ? [
                          _leftPanelEmpty(
                            'Belum Ada Template Resep',
                            widget.kdDokter.isNotEmpty ? 'Isi racikan lalu klik "Jadikan Template Resep" utk menyimpannya di sini.' : 'Dokter peresep belum ada — template bersifat pribadi per dokter.',
                          ),
                        ]
                      : [for (final t in _list) _buildTemplate(t)],
                ),
        ),
      ],
    );
  }

  Widget _buildTemplate(Map<String, dynamic> tmpl) {
    String s(Map<String, dynamic> m, String key) => '${m[key] ?? ''}';
    String dash(String v) => v.isEmpty ? '-' : v;
    Text c(String text, {TextAlign align = TextAlign.left}) => Text(text, textAlign: align, style: _kCellStyle);
    Text h(String text) => Text(text, style: _kHeadStyle);
    final detail = (tmpl['detail'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        children: [
          _gridTable(
            widths: const [0, 92, 56, 0, 88],
            header: [h('Nama Template'), h('Metode Racik'), h('Jumlah'), h('Aturan Pakai'), Center(child: _panelActionButton('Pilih', Icons.check, () => Navigator.of(context).pop(tmpl)))],
            rows: [
              [c(s(tmpl, 'nama_template')), c(dash(s(tmpl, 'metode_racik'))), c(s(tmpl, 'jml_dr')), c(dash(s(tmpl, 'aturan_pakai'))), const SizedBox.shrink()],
            ],
          ),
          _gridTable(
            widths: const [30, 84, 0, 80, 80],
            header: [h('No'), h('Kode'), h('Nama Obat'), h('Kandungan'), h('Jumlah')],
            rows: [
              for (var i = 0; i < detail.length; i++)
                [c('${i + 1}', align: TextAlign.center), c(s(detail[i], 'kode_brng')), c(s(detail[i], 'nama_brng')), c(dash(s(detail[i], 'kandungan')), align: TextAlign.center), c('${s(detail[i], 'jml')} ${s(detail[i], 'kode_sat')}', align: TextAlign.center)],
            ],
          ),
        ],
      ),
    );
  }
}

/// Dialog nama template utk "Jadikan Template Resep" — nama wajib diisi.
class _NamaTemplateDialog extends StatefulWidget {
  final String initial;
  const _NamaTemplateDialog({required this.initial});

  @override
  State<_NamaTemplateDialog> createState() => _NamaTemplateDialogState();
}

class _NamaTemplateDialogState extends State<_NamaTemplateDialog> {
  late final _nama = TextEditingController(text: widget.initial);
  String? _error;

  @override
  void dispose() {
    _nama.dispose();
    super.dispose();
  }

  void _confirm() {
    final nama = _nama.text.trim();
    if (nama.isEmpty) {
      setState(() => _error = 'Nama template wajib diisi');
      return;
    }
    Navigator.of(context).pop(nama);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      insetPadding: _panelDialogInsets(context),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      title: const Text('Jadikan Template Resep', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _dialogLabel('Nama Template'),
            TextField(controller: _nama, autofocus: true, onSubmitted: (_) => _confirm(), decoration: _dialogDeco(hint: 'mis. Puyer Batuk Anak'), style: const TextStyle(fontSize: 13)),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Batal')),
        TextButton(onPressed: _confirm, child: const Text('Simpan')),
      ],
    );
  }
}
