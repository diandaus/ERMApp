import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_client.dart';
import '../services/api_config.dart';
import '../services/rad_service.dart';
import '../theme/app_theme.dart' show kPrimary, kText, kTextMuted;

const _kBorder = Color(0xFFE6E8E8);
const _kInputBorder = Color(0xFFD1D5DB);
const _kGreen = Color(0xFF04C99E);

/// showUsgInputPanel — modal "Input Hasil Pemeriksaan USG", gaya SAMA dgn
/// modal Input Tindakan: di tengah horizontal, menempel di bawah status bar
/// sampai dasar layar, header ✕ + judul & blok "Simpan" di pojok kanan atas.
/// Balikin true kalau hasil tersimpan.
Future<bool> showUsgInputPanel(
  BuildContext context, {
  required String noorder,
  required String noRawat,
  required String noRkmMedis,
  required String nmPasien,
  required String umur,
  required String kdDokter,
  required String nmDokter,
  required String userNip,
}) async {
  final saved = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Input Hasil Pemeriksaan USG',
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, _, __) => Padding(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      child: Align(
        alignment: Alignment.topCenter,
        child: FractionallySizedBox(
          widthFactor: 0.64,
          heightFactor: 1,
          child: _UsgInputPanel(noorder: noorder, noRawat: noRawat, noRkmMedis: noRkmMedis, nmPasien: nmPasien, umur: umur, kdDokter: kdDokter, nmDokter: nmDokter, userNip: userNip),
        ),
      ),
    ),
    transitionBuilder: (context, anim, __, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(scale: Tween<double>(begin: 0.96, end: 1).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)), child: child),
    ),
  );
  return saved == true;
}

/// _UsgInputPanel — padanan ModalInputUSG.tsx (web). Endpoint SAMA PERSIS
/// (GET /api/radiologi/permintaan/:noorder, POST /api/radiologi/hasil,
/// /api/satu-sehat/dicom/preview-*, /api/petugas), tidak ada endpoint baru.
///
/// Dokter P.J. read-only, terkunci ke dokter poliklinik kunjungan ini
/// (alur USG Kandungan: dokter poli yg periksa sendiri, tidak ada radiolog
/// terpisah); Dokter Perujuk tidak ditampilkan tapi tetap dikirim = dokter
/// yg sama. Foto USG CUMA ditampilkan kalau backend menemukannya PERSIS by
/// AccessionNumber order ini (search_mode 'accession_number') — kalau
/// backend fallback cari by No.RM, foto lama pasien yg tak relevan bisa
/// nyasar, jadi sengaja dikosongkan.
class _UsgInputPanel extends StatefulWidget {
  final String noorder;
  final String noRawat;
  final String noRkmMedis;
  final String nmPasien;
  final String umur;
  final String kdDokter;
  final String nmDokter;
  final String userNip;
  const _UsgInputPanel({required this.noorder, required this.noRawat, required this.noRkmMedis, required this.nmPasien, required this.umur, required this.kdDokter, required this.nmDokter, required this.userNip});

  @override
  State<_UsgInputPanel> createState() => _UsgInputPanelState();
}

class _UsgInputPanelState extends State<_UsgInputPanel> {
  bool _loading = true;
  String? _loadError;
  List<Map<String, dynamic>> _exams = [];
  final _hasil = TextEditingController();

  final _petugasCtrl = TextEditingController();
  final _petugasFocus = FocusNode();
  String _petugasNip = '';
  List<Map<String, dynamic>> _petugasList = [];
  Timer? _petugasDebounce;

  bool _otomatisJam = true;
  DateTime _tgl = DateTime.now();
  TimeOfDay _jam = TimeOfDay.now();

  bool _loadingFoto = true;
  List<String> _fotoIds = [];

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _petugasFocus.addListener(() => setState(() {}));
    _loadDetail();
    _loadFoto();
  }

  @override
  void dispose() {
    _petugasDebounce?.cancel();
    _hasil.dispose();
    _petugasCtrl.dispose();
    _petugasFocus.dispose();
    super.dispose();
  }

  /// Detail permintaan — daftar pemeriksaan + hasil/petugas yg SUDAH
  /// pernah diisi (kalau order yg sama dibuka ulang utk koreksi).
  Future<void> _loadDetail() async {
    try {
      final data = await RadService.getPermintaanDetail(widget.noorder);
      if (!mounted) return;
      final nipTerakhir = data['petugas_nip_terakhir'] as String? ?? '';
      setState(() {
        _exams = (data['pemeriksaan'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
        _hasil.text = data['hasil_terakhir'] as String? ?? '';
        if (data['sudah_ada_hasil'] == true && nipTerakhir.isNotEmpty) {
          _petugasNip = nipTerakhir;
          final nama = data['petugas_nama_terakhir'] as String? ?? '';
          _petugasCtrl.text = nama.isEmpty ? nipTerakhir : nama;
        }
        _loading = false;
      });
      if (_petugasNip.isEmpty) _defaultPetugas();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e is ApiException ? e.message : 'Gagal memuat detail permintaan USG';
        _loading = false;
      });
    }
  }

  /// Petugas default = akun yg login (dicocokkan PERSIS by NIP), kecuali
  /// sudah terisi dari hasil sebelumnya.
  Future<void> _defaultPetugas() async {
    if (widget.userNip.isEmpty) return;
    try {
      final list = await RadService.searchPetugas(widget.userNip);
      final match = list.where((p) => p['nip'] == widget.userNip).firstOrNull;
      if (match == null || !mounted || _petugasNip.isNotEmpty) return;
      setState(() {
        _petugasNip = widget.userNip;
        _petugasCtrl.text = match['nama'] as String? ?? widget.userNip;
      });
    } catch (_) {/* diam, petugas dipilih manual */}
  }

  Future<void> _loadFoto() async {
    var ids = <String>[];
    try {
      final data = await RadService.getDicomPreviewList(widget.noorder);
      if (data['search_mode'] == 'accession_number') {
        ids = (data['instances'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().map((i) => i['id'] as String? ?? '').where((id) => id.isNotEmpty).toList();
      }
    } catch (_) {/* diam, tampil "Belum ada foto USG" */}
    if (!mounted) return;
    setState(() {
      _fotoIds = ids;
      _loadingFoto = false;
    });
  }

  void _onPetugasChanged(String value) {
    // Mengetik lagi = pilihan sebelumnya batal sampai dipilih ulang.
    setState(() => _petugasNip = '');
    _petugasDebounce?.cancel();
    _petugasDebounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final list = await RadService.searchPetugas(value.trim());
        if (mounted && _petugasCtrl.text == value) setState(() => _petugasList = list);
      } catch (_) {/* diam */}
    });
  }

  Future<void> _pickTgl() async {
    final picked = await showDatePicker(context: context, initialDate: _tgl, firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (picked != null) setState(() => _tgl = picked);
  }

  Future<void> _pickJam() async {
    final picked = await showTimePicker(context: context, initialTime: _jam);
    if (picked != null) setState(() => _jam = picked);
  }

  String get _jamText => '${_jam.hour.toString().padLeft(2, '0')}:${_jam.minute.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    String? invalid;
    if (_petugasNip.isEmpty) {
      invalid = 'Pilih Petugas dulu';
    } else if (widget.kdDokter.isEmpty) {
      invalid = 'Dokter poliklinik pasien ini belum diketahui — periksa data kunjungan.';
    } else if (_hasil.text.trim().isEmpty) {
      invalid = 'Isi Hasil Pemeriksaan dulu';
    }
    if (invalid != null) {
      setState(() => _error = invalid);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await RadService.saveHasil({
        'noorder': widget.noorder,
        'no_rawat': widget.noRawat,
        'nip': _petugasNip,
        'kd_dokter': widget.kdDokter,
        'dokter_perujuk': widget.kdDokter,
        'pemeriksaan': _exams.map((e) => {'kd_jenis_prw': e['kd_jenis_prw']}).toList(),
        'hasil': _hasil.text.trim(),
        // Kosong = backend pakai waktu sekarang (centang "Otomatis").
        'tgl': _otomatisJam ? '' : DateFormat('yyyy-MM-dd').format(_tgl),
        'jam': _otomatisJam ? '' : _jamText,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Gagal menyimpan hasil pemeriksaan USG';
        _saving = false;
      });
    }
  }

  void _previewFoto(String url) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (ctx) => GestureDetector(
        onTap: () => Navigator.of(ctx).pop(),
        child: Stack(
          children: [
            Center(child: InteractiveViewer(child: Image.network(url, fit: BoxFit.contain))),
            Positioned(top: 20, right: 20, child: IconButton(icon: const Icon(Icons.close, color: Colors.white, size: 28), onPressed: () => Navigator.of(ctx).pop())),
          ],
        ),
      ),
    );
  }

  InputDecoration _deco({String? hint, bool readOnly = false}) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
        isDense: true,
        filled: true,
        fillColor: readOnly ? const Color(0xFFF3F4F6) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: _kInputBorder)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: _kInputBorder)),
      );

  Widget _label(String text, {bool required = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text.rich(
          TextSpan(text: text, children: [if (required) const TextSpan(text: ' *', style: TextStyle(color: Color(0xFFEF4444)))]),
          style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final info = [widget.noRawat, widget.noRkmMedis, widget.nmPasien, widget.umur].where((v) => v.isNotEmpty).join('  |  ');
    final bisaSimpan = !_saving && !_loading && _loadError == null;
    return Material(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header setinggi navbar (60), sama dgn modal Input Tindakan: X +
          // judul (+ info pasien) kiri, blok "Simpan" tosca pojok kanan atas.
          Container(
            height: 60,
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _kBorder))),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Tutup',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, size: 26, color: kText),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Input Hasil USG', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: kText)),
                      if (info.isNotEmpty)
                        Text(info, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: kTextMuted)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Material(
                  color: bisaSimpan ? kPrimary : const Color(0xFFDADDDD),
                  child: InkWell(
                    onTap: bisaSimpan ? _submit : null,
                    child: Container(
                      width: 170,
                      alignment: Alignment.center,
                      child: Text(
                        _saving ? 'Menyimpan...' : 'Simpan',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: bisaSimpan ? Colors.white : const Color(0xFFA3A8A8)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _loadError != null
                    ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_loadError!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
                    : ListView(padding: const EdgeInsets.all(20), children: _buildBody()),
          ),
          if (_error != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), border: Border.all(color: const Color(0xFFFCA5A5)), borderRadius: BorderRadius.circular(6)),
              child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B))),
            ),
        ],
      ),
    );
  }

  List<Widget> _buildBody() {
    final showPetugasList = _petugasFocus.hasFocus && _petugasNip.isEmpty && _petugasList.isNotEmpty;
    return [
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _label('Dokter Penanggung Jawab'),
                TextField(controller: TextEditingController(text: widget.nmDokter.isEmpty ? '-' : widget.nmDokter), readOnly: true, enableInteractiveSelection: false, decoration: _deco(readOnly: true), style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _label('Petugas', required: true),
                TextField(
                  controller: _petugasCtrl,
                  focusNode: _petugasFocus,
                  onChanged: _onPetugasChanged,
                  onTap: () {
                    if (_petugasList.isEmpty) _onPetugasChanged(_petugasCtrl.text);
                  },
                  decoration: _deco(hint: 'Cari nama petugas...').copyWith(suffixIcon: _petugasNip.isNotEmpty ? const Icon(Icons.check_circle, size: 16, color: _kGreen) : null, suffixIconConstraints: const BoxConstraints(minWidth: 30, minHeight: 30)),
                  style: const TextStyle(fontSize: 12),
                ),
                if (showPetugasList)
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
                        final nip = p['nip'] as String? ?? '';
                        final nama = p['nama'] as String? ?? '';
                        return InkWell(
                          onTap: () {
                            setState(() {
                              _petugasNip = nip;
                              _petugasCtrl.text = nama;
                              _error = null;
                            });
                            _petugasFocus.unfocus();
                          },
                          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9), child: Text('$nama ($nip)', style: const TextStyle(fontSize: 12))),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      const SizedBox(height: 16),
      _label('Tanggal / Jam'),
      Row(
        children: [
          _pickerBox(DateFormat('dd/MM/yyyy').format(_tgl), Icons.calendar_today_outlined, 150, _pickTgl),
          const SizedBox(width: 8),
          _pickerBox(_jamText, Icons.schedule, 100, _pickJam),
          const SizedBox(width: 4),
          Checkbox(value: _otomatisJam, activeColor: _kGreen, visualDensity: VisualDensity.compact, onChanged: (v) => setState(() => _otomatisJam = v ?? true)),
          const Text('Otomatis', style: TextStyle(fontSize: 12, color: Color(0xFF374151))),
        ],
      ),
      const SizedBox(height: 16),
      _label('Pemeriksaan'),
      Container(
        decoration: BoxDecoration(border: Border.all(color: _kInputBorder), borderRadius: BorderRadius.circular(4)),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            Container(
              color: const Color(0xFFF3F4F6),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
              child: const Row(children: [SizedBox(width: 90, child: Text('Kode', style: TextStyle(fontSize: 12, color: Color(0xFF374151)))), Expanded(child: Text('Nama Pemeriksaan', style: TextStyle(fontSize: 12, color: Color(0xFF374151))))]),
            ),
            if (_exams.isEmpty)
              const Padding(padding: EdgeInsets.all(16), child: Text('Tidak ada pemeriksaan pada permintaan ini', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))))
            else
              for (final e in _exams)
                Container(
                  decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFF3F4F6)))),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                  child: Row(children: [SizedBox(width: 90, child: Text('${e['kd_jenis_prw'] ?? ''}', style: const TextStyle(fontSize: 12))), Expanded(child: Text('${e['nm_perawatan'] ?? ''}', style: const TextStyle(fontSize: 12)))]),
                ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      // Foto USG (kiri) + Hasil Pemeriksaan (kanan).
      SizedBox(
        height: 300,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _label('Foto USG (dari Orthanc)'),
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.black, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(4)),
                      child: _buildFoto(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _label('Hasil Pemeriksaan', required: true),
                  Expanded(
                    child: TextField(
                      controller: _hasil,
                      maxLines: null,
                      expands: true,
                      textAlignVertical: TextAlignVertical.top,
                      decoration: _deco(hint: 'Tulis hasil bacaan/expertise USG...'),
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ];
  }

  /// Kotak tanggal/jam — nonaktif (abu) selama "Otomatis" dicentang.
  Widget _pickerBox(String text, IconData icon, double width, VoidCallback onTap) {
    return InkWell(
      onTap: _otomatisJam ? null : onTap,
      child: Container(
        width: width,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(color: _otomatisJam ? const Color(0xFFF3F4F6) : Colors.white, border: Border.all(color: _kInputBorder), borderRadius: BorderRadius.circular(4)),
        child: Row(
          children: [
            Icon(icon, size: 14, color: const Color(0xFF6B7280)),
            const SizedBox(width: 8),
            Text(text, style: TextStyle(fontSize: 12, color: _otomatisJam ? const Color(0xFF9CA3AF) : const Color(0xFF111827))),
          ],
        ),
      ),
    );
  }

  Widget _buildFoto() {
    if (_loadingFoto) return const Center(child: Text('Memuat dari Orthanc...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))));
    if (_fotoIds.isEmpty) return const Center(child: Text('Belum ada foto USG untuk pemeriksaan ini', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))));
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 8,
      mainAxisSpacing: 8,
      children: [
        for (final id in _fotoIds)
          Builder(builder: (context) {
            final url = '$kApiBaseUrl/api/satu-sehat/dicom/preview-image/$id';
            return InkWell(
              onTap: () => _previewFoto(url),
              child: Container(
                decoration: BoxDecoration(color: const Color(0xFF111827), border: Border.all(color: const Color(0xFF374151)), borderRadius: BorderRadius.circular(6)),
                clipBehavior: Clip.antiAlias,
                child: Image.network(url, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
              ),
            );
          }),
      ],
    );
  }
}
