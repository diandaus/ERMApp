import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../models/ranap_patient.dart';
import '../models/soap_item.dart';
import '../services/soap_service.dart';

const kBorder = Color(0xFFE5E7EB);
const kPrimary = Color(0xFF2563EB);

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
  bool _saving = false;
  bool _showDetail = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
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
      await SoapService.simpan(
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
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('SOAP/CPPT berhasil disimpan'), backgroundColor: Color(0xFF16A34A)));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal simpan: $e'), backgroundColor: const Color(0xFFDC2626)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
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
      padding: const EdgeInsets.all(16),
      child: Column(children: [isLandscape ? _buildFormLandscape() : _buildFormPortrait(), const SizedBox(height: 16), _buildRiwayat()]),
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
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Input SOAP/CPPT', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          child,
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _submit,
              style: ElevatedButton.styleFrom(backgroundColor: kPrimary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
              child: _saving ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Simpan SOAP'),
            ),
          ),
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
        decoration: InputDecoration(labelText: label, suffixText: suffix, isDense: true, border: const OutlineInputBorder()),
        style: const TextStyle(fontSize: 13),
      );

  Widget _buildRiwayat() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(10)),
      constraints: const BoxConstraints(minHeight: 200),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Rincian Riwayat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
          else if (_error != null)
            Padding(padding: const EdgeInsets.all(16), child: Center(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
          else if (_riwayat.isEmpty)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: Text('Belum ada riwayat SOAP/CPPT', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
          else
            ..._riwayat.map((s) => _RiwayatCard(item: s)),
        ],
      ),
    );
  }
}

class _RiwayatCard extends StatelessWidget {
  final SoapItem item;
  const _RiwayatCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: const Color(0xFFF9FAFB), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${item.tglPerawatan} ${item.jamRawat} · ${item.nama}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
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
}
