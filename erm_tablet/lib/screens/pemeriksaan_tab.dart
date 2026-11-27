import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../models/ranap_patient.dart';
import '../models/soap_item.dart';
import '../services/api_client.dart';
import '../services/soap_ralan_service.dart' show soapDateToApi;
import '../services/soap_service.dart';
import '../widgets/grafik_ttv_panel.dart';

const kBorder = Color(0xFFE6E8E8);
const kPrimary = Color(0xFF04B58E);
const kPrimaryBtn = Color(0xFF04C99E);

/// PemeriksaanTab — SOAP/CPPT Rawat Inap, padanan tab SOAP/CPPT di
/// PemeriksaanRanap.tsx (web). Form input + Rincian Riwayat (scrollable),
/// endpoint sama persis (/api/pemeriksaan-ranap), tidak ada endpoint baru.
/// Kolom Pegawai SENGAJA tidak ditampilkan (beda dr web yg msh nampilin +
/// bisa diganti manual) — di tablet cukup diisi otomatis dr akun yg login
/// (widget.user.nip/fullName) saat Simpan SOAP, sesuai arahan user.
/// SOAPIE lengkap: Keluhan(S)/Pemeriksaan(O)/Penilaian(A)/Planning(P) wajib
/// diisi, Instruksi/Implementasi(I) & Evaluasi(E) opsional — persis pola
/// required di web (cuma subjective/objective/assessment yg required attr).
/// Vital Sign lengkap (Tensi/Nadi/Suhu/Respirasi/SpO2/GCS/TB/BB/Kesadaran/
/// Alergi — persis field di web) msh disembunyikan di balik "Tambah Vital
/// Sign (opsional)" (expandable) spy form tetap ringkas di layar tablet.
/// L.P. (lingkar perut) SENGAJA TIDAK direplikasi — backend
/// pemeriksaan_ranap_handler.go tidak punya kolom itu sama sekali (beda
/// dr pemeriksaan_ralan), nilainya dibuang diam2 kalau dikirim.
class PemeriksaanTab extends StatefulWidget {
  final AppUser user;
  final RanapPatient patient;
  const PemeriksaanTab({super.key, required this.user, required this.patient});

  @override
  State<PemeriksaanTab> createState() => _PemeriksaanTabState();
}

class _PemeriksaanTabState extends State<PemeriksaanTab> {
  bool _loading = true;
  String? _error;
  List<SoapItem> _riwayat = [];

  final _keluhanCtrl = TextEditingController();
  final _pemeriksaanCtrl = TextEditingController();
  final _penilaianCtrl = TextEditingController();
  final _planningCtrl = TextEditingController();
  final _instruksiCtrl = TextEditingController();
  final _evaluasiCtrl = TextEditingController();
  final _tensiCtrl = TextEditingController();
  final _suhuCtrl = TextEditingController();
  final _nadiCtrl = TextEditingController();
  final _respirasiCtrl = TextEditingController();
  final _spo2Ctrl = TextEditingController();
  final _gcsCtrl = TextEditingController();
  final _tinggiCtrl = TextEditingController();
  final _beratCtrl = TextEditingController();
  final _alergiCtrl = TextEditingController();
  String _kesadaran = 'Compos Mentis';
  static const _kKesadaran = ['Compos Mentis', 'Apatis', 'Delirium', 'Somnolen', 'Sopor', 'Coma'];
  // Baris riwayat yg sedang diedit (null = input baru). Tgl/jam baris itu
  // jadi kunci UPDATE (PUT), sama dgn isEditMode PemeriksaanRanap.tsx.
  SoapItem? _editing;
  final _scroll = ScrollController();
  bool _saving = false;
  bool _showDetail = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    _keluhanCtrl.dispose();
    _pemeriksaanCtrl.dispose();
    _penilaianCtrl.dispose();
    _planningCtrl.dispose();
    _instruksiCtrl.dispose();
    _evaluasiCtrl.dispose();
    _tensiCtrl.dispose();
    _suhuCtrl.dispose();
    _nadiCtrl.dispose();
    _respirasiCtrl.dispose();
    _spo2Ctrl.dispose();
    _gcsCtrl.dispose();
    _tinggiCtrl.dispose();
    _beratCtrl.dispose();
    _alergiCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await SoapService.getRiwayat(widget.patient.noRawat);
      if (!mounted) return;
      setState(() {
        _riwayat = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil riwayat SOAP/CPPT';
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    if (widget.user.nip.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Akun ini belum punya NIP terdaftar, hubungi admin.')));
      return;
    }
    if (_keluhanCtrl.text.trim().isEmpty || _pemeriksaanCtrl.text.trim().isEmpty || _penilaianCtrl.text.trim().isEmpty || _planningCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Keluhan, Pemeriksaan, Penilaian, Planning wajib diisi.')));
      return;
    }
    setState(() => _saving = true);
    try {
      final editing = _editing;
      await SoapService.simpan(
        tglPerawatan: editing == null ? null : soapDateToApi(editing.tglPerawatan),
        jamRawat: editing == null ? null : _jam(editing.jamRawat),
        noRawat: widget.patient.noRawat,
        nip: widget.user.nip,
        keluhan: _keluhanCtrl.text.trim(),
        pemeriksaan: _pemeriksaanCtrl.text.trim(),
        penilaian: _penilaianCtrl.text.trim(),
        rtl: _planningCtrl.text.trim(),
        instruksi: _instruksiCtrl.text.trim(),
        evaluasi: _evaluasiCtrl.text.trim(),
        tensi: _tensiCtrl.text.trim(),
        suhuTubuh: _suhuCtrl.text.trim(),
        nadi: _nadiCtrl.text.trim(),
        respirasi: _respirasiCtrl.text.trim(),
        spo2: _spo2Ctrl.text.trim(),
        gcs: _gcsCtrl.text.trim(),
        tinggi: _tinggiCtrl.text.trim(),
        berat: _beratCtrl.text.trim(),
        kesadaran: _kesadaran,
        alergi: _alergiCtrl.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _keluhanCtrl.clear();
        _pemeriksaanCtrl.clear();
        _penilaianCtrl.clear();
        _planningCtrl.clear();
        _instruksiCtrl.clear();
        _evaluasiCtrl.clear();
        _tensiCtrl.clear();
        _suhuCtrl.clear();
        _nadiCtrl.clear();
        _respirasiCtrl.clear();
        _spo2Ctrl.clear();
        _gcsCtrl.clear();
        _tinggiCtrl.clear();
        _beratCtrl.clear();
        _alergiCtrl.clear();
        _kesadaran = 'Compos Mentis';
        _editing = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(editing != null ? 'SOAP/CPPT berhasil diupdate' : 'SOAP/CPPT berhasil disimpan'), backgroundColor: const Color(0xFF16A34A)));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal simpan: $e'), backgroundColor: const Color(0xFFDC2626)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Jam selalu HH:MM:SS (padanan normalisasi di PemeriksaanRanap.tsx).
  String _jam(String jam) => jam.length == 5 ? '$jam:00' : (jam.isEmpty ? '00:00:00' : jam);

  void _fillForm(SoapItem it) {
    _keluhanCtrl.text = it.keluhan;
    _pemeriksaanCtrl.text = it.pemeriksaan;
    _penilaianCtrl.text = it.penilaian;
    _planningCtrl.text = it.rtl;
    _instruksiCtrl.text = it.instruksi;
    _evaluasiCtrl.text = it.evaluasi;
    _tensiCtrl.text = it.tensi;
    _suhuCtrl.text = it.suhuTubuh;
    _nadiCtrl.text = it.nadi;
    _respirasiCtrl.text = it.respirasi;
    _spo2Ctrl.text = it.spo2;
    _gcsCtrl.text = it.gcs;
    _tinggiCtrl.text = it.tinggi;
    _beratCtrl.text = it.berat;
    _alergiCtrl.text = it.alergi;
    _kesadaran = _kKesadaran.contains(it.kesadaran) ? it.kesadaran : _kKesadaran.first;
    // Vital sign terisi -> buka bagian Vital Sign (portrait) supaya terlihat.
    if ([it.tensi, it.suhuTubuh, it.nadi, it.respirasi, it.spo2, it.gcs, it.tinggi, it.berat, it.alergi].any((v) => v.isNotEmpty)) {
      _showDetail = true;
    }
    if (_scroll.hasClients) _scroll.animateTo(0, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  }

  void _clearForm() {
    setState(() {
      for (final c in [_keluhanCtrl, _pemeriksaanCtrl, _penilaianCtrl, _planningCtrl, _instruksiCtrl, _evaluasiCtrl, _tensiCtrl, _suhuCtrl, _nadiCtrl, _respirasiCtrl, _spo2Ctrl, _gcsCtrl, _tinggiCtrl, _beratCtrl, _alergiCtrl]) {
        c.clear();
      }
      _kesadaran = 'Compos Mentis';
      _editing = null;
    });
  }

  void _openGrafikTtv() {
    final p = widget.patient;
    showGrafikTtvPanel(context,
        riwayat: _riwayat,
        subtitle: [p.noRawat, p.noRkmMedis, p.nmPasien, p.umur].where((v) => v.isNotEmpty).join('  |  '));
  }

  void _edit(SoapItem it) => setState(() {
        _fillForm(it);
        _editing = it;
      });

  void _copy(SoapItem it) {
    setState(() {
      _fillForm(it);
      _editing = null;
    });
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Data SOAP berhasil di-copy ke form'), backgroundColor: Color(0xFF16A34A)));
  }

  Future<void> _hapus(SoapItem it) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Yakin ingin menghapus?'),
        content: Text('Data SOAP ${it.tglPerawatan} ${it.jamRawat} akan dihapus secara permanen.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Ya, Hapus', style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await SoapService.hapus(noRawat: widget.patient.noRawat, tglPerawatan: soapDateToApi(it.tglPerawatan), jamRawat: _jam(it.jamRawat));
      if (!mounted) return;
      if (identical(_editing, it)) _clearForm();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('SOAP berhasil dihapus'), backgroundColor: Color(0xFF16A34A)));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e is ApiException ? e.message : 'Gagal menghapus SOAP'), backgroundColor: const Color(0xFFDC2626)));
    }
  }

  Widget _editBanner() {
    final e = _editing!;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: const Color(0xFFEBFAED), border: Border.all(color: kPrimaryBtn), borderRadius: BorderRadius.circular(4)),
      child: Row(children: [
        Expanded(
          child: Text('Mode Edit — mengubah data SOAP/CPPT tanggal ${e.tglPerawatan} ${e.jamRawat}. Tanggal/Jam dikunci karena jadi kunci data.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF065F46))),
        ),
        const SizedBox(width: 12),
        OutlinedButton(
          onPressed: _clearForm,
          style: OutlinedButton.styleFrom(
              side: const BorderSide(color: kPrimaryBtn),
              minimumSize: Size.zero,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
          child: const Text('Batal Edit', style: TextStyle(fontSize: 12, color: Color(0xFF065F46))),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Rincian Riwayat SELALU di bawah form input, tidak pernah di samping
    // (dua-kolom) — sesuai arahan user, konsisten dgn RanapListScreen yg
    // juga single-pane/push-navigation, bukan split-view. Form input SOAP
    // ITU SENDIRI beda per orientasi: portrait tetap 1 kolom, landscape
    // dibagi 2 grid (kiri S/O+Vital Sign, kanan A/P/I/E) padanan persis
    // PemeriksaanRanap.tsx (web), per arahan user.
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
    return SingleChildScrollView(
      controller: _scroll,
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        if (_editing != null) _editBanner(),
        isLandscape ? _buildFormLandscape() : _buildFormPortrait(),
        const SizedBox(height: 16),
        _buildRiwayat(),
      ]),
    );
  }

  Widget _buildFormPortrait() {
    return _formShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel('Keluhan'),
          _textArea(_keluhanCtrl, 'Keluhan yang disampaikan pasien...'),
          const SizedBox(height: 10),
          _fieldLabel('Pemeriksaan'),
          _textArea(_pemeriksaanCtrl, 'Hasil pemeriksaan fisik...'),
          const SizedBox(height: 10),
          _fieldLabel('Penilaian (Assessment)'),
          _textArea(_penilaianCtrl, 'Diagnosa/penilaian klinis...'),
          const SizedBox(height: 10),
          _fieldLabel('Planning'),
          _textArea(_planningCtrl, 'Rencana tindak lanjut...'),
          const SizedBox(height: 10),
          _fieldLabel('Instruksi/Implementasi'),
          _textArea(_instruksiCtrl, 'Instruksi perawatan...'),
          const SizedBox(height: 10),
          _fieldLabel('Evaluasi'),
          _textArea(_evaluasiCtrl, 'Evaluasi dan catatan lanjutan...'),
          const SizedBox(height: 4),
          ..._vitalSignSection(),
        ],
      ),
    );
  }

  /// _buildFormLandscape — padanan persis grid 2 kolom PemeriksaanRanap.tsx
  /// (web): kiri Keluhan(S)+Pemeriksaan(O)+Vital Sign, kanan Penilaian(A)+
  /// Planning(P)+Instruksi(I)+Evaluasi(E).
  Widget _buildFormLandscape() {
    return _formShell(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _fieldLabel('Keluhan'),
                _textArea(_keluhanCtrl, 'Keluhan yang disampaikan pasien...'),
                const SizedBox(height: 10),
                _fieldLabel('Pemeriksaan'),
                _textArea(_pemeriksaanCtrl, 'Hasil pemeriksaan fisik...'),
                const SizedBox(height: 10),
                // Landscape: Vital Sign LANGSUNG tampil, tanpa toggle
                // sembunyikan/tampilkan spt portrait — ruang sudah cukup.
                ..._vitalSignSection(alwaysShow: true),
              ],
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _fieldLabel('Penilaian (Assessment)'),
                _textArea(_penilaianCtrl, 'Diagnosa/penilaian klinis...'),
                const SizedBox(height: 10),
                _fieldLabel('Planning'),
                _textArea(_planningCtrl, 'Rencana tindak lanjut...'),
                const SizedBox(height: 10),
                _fieldLabel('Instruksi/Implementasi'),
                _textArea(_instruksiCtrl, 'Instruksi perawatan...'),
                const SizedBox(height: 10),
                _fieldLabel('Evaluasi'),
                _textArea(_evaluasiCtrl, 'Evaluasi dan catatan lanjutan...'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// _formShell — bungkus "Input SOAP/CPPT" + field (portrait/landscape) +
  /// tombol Simpan, sama persis utk kedua orientasi.
  Widget _formShell({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Input SOAP/CPPT', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          child,
          const SizedBox(height: 14),
          // Simpan + Clear (kosongkan form / batal edit) + Grafik TTV
          // (modal grafik tanda vital dari riwayat SOAP kunjungan ini).
          Row(children: [
            Expanded(
              child: ElevatedButton(
                onPressed: _saving ? null : _submit,
                style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimaryBtn,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
                child: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(_editing != null ? 'Update SOAP' : 'Simpan SOAP'),
              ),
            ),
            const SizedBox(width: 10),
            OutlinedButton.icon(
              onPressed: _saving ? null : _clearForm,
              icon: const Icon(Icons.clear_all, size: 18, color: Color(0xFF4B5563)),
              label: const Text('Clear', style: TextStyle(color: Color(0xFF4B5563))),
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 48),
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  side: const BorderSide(color: Color(0xFFCFD1D1)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
            ),
            const SizedBox(width: 10),
            OutlinedButton.icon(
              onPressed: _openGrafikTtv,
              icon: const Icon(Icons.show_chart, size: 18, color: kPrimaryBtn),
              label: const Text('Grafik TTV', style: TextStyle(color: kPrimaryBtn)),
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 48),
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  side: const BorderSide(color: kPrimaryBtn),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6))),
            ),
          ]),
        ],
      ),
    );
  }

  /// alwaysShow — landscape ruangnya sudah cukup lebar, jadi Vital Sign
  /// langsung tampil tanpa toggle "Tambah Vital Sign (opsional)" spt
  /// portrait (yg msh butuh diringkas krn layar sempit).
  List<Widget> _vitalSignSection({bool alwaysShow = false}) {
    final show = alwaysShow || _showDetail;
    return [
      if (!alwaysShow)
        TextButton.icon(
          onPressed: () => setState(() => _showDetail = !_showDetail),
          icon: Icon(_showDetail ? Icons.expand_less : Icons.expand_more, size: 18),
          label: Text(_showDetail ? 'Sembunyikan Vital Sign' : 'Tambah Vital Sign (opsional)', style: const TextStyle(fontSize: 12)),
        ),
      if (alwaysShow) _fieldLabel('Vital Sign'),
      if (show) ...[
        // Vital Sign diatur 4 grid per baris (padanan gridTemplateColumns:
        // repeat(4,1fr) di web), bukan 2x2 lagi.
        Row(
          children: [
            Expanded(child: _shortField(_tensiCtrl, 'Tensi', 'mmHg')),
            const SizedBox(width: 8),
            Expanded(child: _shortField(_nadiCtrl, 'Nadi', 'x/mnt')),
            const SizedBox(width: 8),
            Expanded(child: _shortField(_suhuCtrl, 'Suhu', '°C')),
            const SizedBox(width: 8),
            Expanded(child: _shortField(_respirasiCtrl, 'RR', 'x/mnt')),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _shortField(_spo2Ctrl, 'SpO2', '%')),
            const SizedBox(width: 8),
            Expanded(child: _shortField(_gcsCtrl, 'GCS', 'E,V,M')),
            const SizedBox(width: 8),
            Expanded(child: _shortField(_tinggiCtrl, 'TB', 'cm')),
            const SizedBox(width: 8),
            Expanded(child: _shortField(_beratCtrl, 'BB', 'Kg')),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel('Kesadaran'),
                  DropdownButtonFormField<String>(
                    value: _kesadaran,
                    decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
                    items: const ['Compos Mentis', 'Apatis', 'Delirium', 'Somnolen', 'Sopor', 'Coma']
                        .map((k) => DropdownMenuItem(value: k, child: Text(k, style: const TextStyle(fontSize: 13))))
                        .toList(),
                    onChanged: (v) => setState(() => _kesadaran = v ?? _kesadaran),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _fieldLabel('Alergi'),
                  TextField(
                    controller: _alergiCtrl,
                    maxLength: 80,
                    decoration: const InputDecoration(isDense: true, border: OutlineInputBorder(), counterText: ''),
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    ];
  }

  Widget _fieldLabel(String text) => Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF374151))));

  Widget _textArea(TextEditingController ctrl, String hint) => TextField(
        controller: ctrl,
        maxLines: 3,
        minLines: 2,
        decoration: InputDecoration(hintText: hint, isDense: true, border: const OutlineInputBorder(), contentPadding: const EdgeInsets.all(10)),
        style: const TextStyle(fontSize: 13),
      );

  Widget _shortField(TextEditingController ctrl, String label, String suffix) => TextField(
        controller: ctrl,
        decoration: InputDecoration(labelText: label, labelStyle: const TextStyle(fontSize: 13), suffixText: suffix, isDense: true, border: const OutlineInputBorder()),
        style: const TextStyle(fontSize: 13),
      );

  Widget _buildRiwayat() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
      constraints: const BoxConstraints(minHeight: 200),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Rincian Riwayat', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
          else if (_error != null)
            Padding(padding: const EdgeInsets.all(16), child: Center(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
          else if (_riwayat.isEmpty)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: Text('Belum ada riwayat SOAP/CPPT', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
          else
            ..._riwayat.map((s) => _RiwayatCard(
                  item: s,
                  editing: identical(_editing, s),
                  onEdit: () => _edit(s),
                  onCopy: () => _copy(s),
                  onDelete: () => _hapus(s),
                )),
        ],
      ),
    );
  }
}

/// Satu baris riwayat SOAP/CPPT + aksi Edit/Copy/Hapus — SAMA dgn kartu
/// riwayat Pemeriksaan Rawat Jalan.
class _RiwayatCard extends StatelessWidget {
  final SoapItem item;
  final bool editing;
  final VoidCallback onEdit;
  final VoidCallback onCopy;
  final VoidCallback onDelete;
  const _RiwayatCard({required this.item, required this.editing, required this.onEdit, required this.onCopy, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: editing ? const Color(0xFFEBFAED) : const Color(0xFFF4F5F5),
        border: Border.all(color: editing ? kPrimaryBtn : Colors.transparent),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text('${item.tglPerawatan} ${item.jamRawat} · ${item.nama}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
            ),
            _action('Edit', Icons.edit_outlined, kPrimaryBtn, onEdit),
            _action('Copy', Icons.copy_outlined, const Color(0xFF6B7280), onCopy),
            _action('Hapus', Icons.delete_outline, const Color(0xFFDC2626), onDelete),
          ]),
          const SizedBox(height: 4),
          Text('S: ${item.keluhan}', style: const TextStyle(fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
          Text('O: ${item.pemeriksaan}', style: const TextStyle(fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
          Text('A: ${item.penilaian}', style: const TextStyle(fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
          Text('P: ${item.rtl}', style: const TextStyle(fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (item.instruksi.isNotEmpty) Text('I: ${item.instruksi}', style: const TextStyle(fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (item.evaluasi.isNotEmpty) Text('E: ${item.evaluasi}', style: const TextStyle(fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _action(String label, IconData icon, Color color, VoidCallback onPressed) => TextButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 14, color: color),
        label: Text(label, style: TextStyle(fontSize: 12, color: color)),
        style: TextButton.styleFrom(minimumSize: Size.zero, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
      );
}
