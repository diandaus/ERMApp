import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/billing_service.dart';
import '../theme/app_theme.dart';

const _kLine = Color(0xFFE6E8E8);
const _kHead = Color(0xFF5F6665);
const _kGreen = Color(0xFF04C99E);
const _kRed = Color(0xFFDC2626);
const _kField = Color(0xFFCFD1D1);

/// BillingTab — rincian billing kunjungan, padanan PreviewBilling.tsx
/// (web) / billing Khanza: GET /api/billing-preview. Baris 0-5 (identitas
/// nota) sengaja tidak ditampilkan (sudah ada di panel Data Pasien);
/// sisanya kelompok biaya + item, ditutup TOTAL BIAYA.
///
/// Tombol "Potongan Biaya" — dokter bisa memberi diskon (mis. konsultasi
/// gratis) lewat tabel Khanza pengurangan_biaya; tarif & jasa medis asli
/// tidak diubah, potongan tampil sbg kelompok "Potongan Biaya" (negatif).
/// Nonaktif kalau nota sudah disimpan kasir. Gaya SAMA dgn tab Tindakan.
class BillingTab extends StatefulWidget {
  final String noRawat;
  const BillingTab({super.key, required this.noRawat});

  @override
  State<BillingTab> createState() => _BillingTabState();
}

class _BillingTabState extends State<BillingTab> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];
  bool _notaTersimpan = false;
  List<Map<String, dynamic>> _potongan = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await Future.wait([BillingService.getPreview(widget.noRawat), BillingService.getPotongan(widget.noRawat)]);
      final pot = res[1] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _rows = res[0] as List<Map<String, dynamic>>;
        _notaTersimpan = pot['nota_tersimpan'] == true;
        _potongan = (pot['potongan'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Gagal memuat data billing');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  num _n(Map<String, dynamic> r, String k) => (r[k] as num?) ?? 0;

  /// Item berbiaya (bukan kepala kelompok/subtotal/potongan) — pilihan cepat
  /// "gratiskan" di dialog potongan.
  List<Map<String, dynamic>> get _itemBerbiaya => [
        for (final r in _rows.skip(6))
          if ('${r['no'] ?? ''}'.trim().isEmpty && _n(r, 'totalbiaya') > 0) r,
      ];

  Future<void> _bukaPotongan() async {
    final berubah = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _PotonganDialog(noRawat: widget.noRawat, potongan: _potongan, items: _itemBerbiaya),
    );
    if (berubah == true) await _load();
  }

  Widget _card(String title, Widget child, {Widget? action}) => Container(
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

  static const _w = [null, 120.0, 70.0, 110.0, 130.0]; // nama, biaya, jml, tambahan, total

  Widget _row(List<Widget> cells, {Color? bg, bool topBorder = true}) => Container(
        decoration: BoxDecoration(color: bg, border: Border(top: topBorder ? const BorderSide(color: _kLine) : BorderSide.none)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(children: [
          for (var i = 0; i < cells.length; i++) _w[i] == null ? Expanded(child: cells[i]) : SizedBox(width: _w[i], child: cells[i]),
        ]),
      );

  Text _t(String s, {bool bold = false, bool right = false, Color color = kText, double size = 15}) =>
      Text(s, textAlign: right ? TextAlign.right : TextAlign.left, style: TextStyle(fontSize: size, fontWeight: bold ? FontWeight.w600 : FontWeight.w400, color: color));

  Widget _rincianRow(Map<String, dynamic> r) {
    final no = '${r['no'] ?? ''}'.trim();
    final nama = '${r['nm_perawatan'] ?? ''}'.trim();
    final biaya = _n(r, 'biaya');
    final tot = _n(r, 'totalbiaya');
    if (no.isNotEmpty) {
      // Kepala kelompok (Registrasi, Tindakan, Obat & BHP, Potongan Biaya, ...).
      final ket = nama.replaceFirst(RegExp(r'^:\s*'), '');
      return _row([
        _t(ket.isEmpty ? no : '$no  $ket', bold: true),
        const SizedBox(),
        const SizedBox(),
        const SizedBox(),
        _t(blankAngka(tot), bold: true, right: true),
      ], bg: const Color(0xFFF4F5F5));
    }
    if (biaya == 0 && tot == 0) {
      // Subtotal: teks "Total X : 1,234" (hitung langsung) atau angka saja
      // (nota tersimpan Khanza); selain itu teks bebas (mis. daftar dokter).
      final m = RegExp(r'^Total\s+(.*?)\s*:\s*(-?[\d.,]+)$').firstMatch(nama);
      if (m != null) {
        return _row([_t('Subtotal ${m[1]}', color: kTextMuted), const SizedBox(), const SizedBox(), const SizedBox(), _t(m[2]!, bold: true, right: true)]);
      }
      if (RegExp(r'^-?[\d.,]+$').hasMatch(nama)) {
        return _row([_t('Subtotal', color: kTextMuted), const SizedBox(), const SizedBox(), const SizedBox(), _t(nama, bold: true, right: true)]);
      }
      return _row([_t(nama), const SizedBox(), const SizedBox(), const SizedBox(), const SizedBox()]);
    }
    final minus = tot < 0;
    return _row([
      _t(nama, color: minus ? _kRed : kText),
      _t(blankAngka(biaya), right: true, color: minus ? _kRed : kText),
      _t(blankAngka(_n(r, 'jumlah')), right: true),
      _t(blankAngka(_n(r, 'tambahan')), right: true),
      _t(blankAngka(tot), right: true, color: minus ? _kRed : kText),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(child: Text(_error!, style: const TextStyle(fontSize: 14, color: _kRed)));
    }

    final rincian = _rows.skip(6).toList();
    final total = _rows.fold<num>(0, (s, r) => s + _n(r, 'totalbiaya'));

    final tombol = OutlinedButton.icon(
      onPressed: _notaTersimpan ? null : _bukaPotongan,
      icon: Icon(Icons.discount_outlined, size: 18, color: _notaTersimpan ? const Color(0xFFA3A8A8) : _kGreen),
      label: Text('Potongan Biaya${_potongan.isEmpty ? '' : ' (${_potongan.length})'}',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _notaTersimpan ? const Color(0xFFA3A8A8) : _kGreen)),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: _notaTersimpan ? const Color(0xFFDADDDD) : _kGreen, width: 1.5),
        minimumSize: const Size(0, 42),
        padding: const EdgeInsets.symmetric(horizontal: 16),
      ),
    );

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        _card(
          'Rincian Biaya',
          action: tombol,
          rincian.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('Belum ada data billing', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
                )
              : Column(children: [
                  if (_notaTersimpan)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFFFF7E6), border: Border.all(color: const Color(0xFFFCD34D)), borderRadius: BorderRadius.circular(6)),
                      child: const Text('Nota billing sudah disimpan kasir — potongan biaya hanya bisa diubah lewat kasir.',
                          style: TextStyle(fontSize: 14, color: Color(0xFF92400E))),
                    ),
                  _row([
                    _t('Perawatan / Item', bold: true, color: _kHead),
                    _t('Biaya', bold: true, right: true, color: _kHead),
                    _t('Jml', bold: true, right: true, color: _kHead),
                    _t('Tambahan', bold: true, right: true, color: _kHead),
                    _t('Total', bold: true, right: true, color: _kHead),
                  ], topBorder: false),
                  for (final r in rincian) _rincianRow(r),
                  Container(
                    decoration: const BoxDecoration(color: Color(0xFFEBFAED), border: Border(top: BorderSide(color: Color(0xFF333333), width: 2))),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                    child: Row(children: [
                      Expanded(child: _t('TOTAL BIAYA', bold: true, size: 16)),
                      _t(formatAngka(total), bold: true, right: true, size: 16),
                    ]),
                  ),
                ]),
        ),
      ]),
    );
  }
}

/// Format angka ala Khanza (Valid.SetAngka): pemisah ribuan koma, tanpa
/// desimal — sama dgn web & subtotal yg dikirim backend.
String formatAngka(num v) {
  final s = v.round().abs().toString();
  final b = StringBuffer(v < 0 ? '-' : '');
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return b.toString();
}

String blankAngka(num v) => v == 0 ? '' : formatAngka(v);

/// Dialog Potongan Biaya: daftar potongan yg ada (hapus) + form tambah.
/// "Gratiskan" pada item mengisi keterangan & besar = total item itu
/// (mis. konsultasi jadi Rp 0 di total akhir). Balikin true kalau berubah.
class _PotonganDialog extends StatefulWidget {
  final String noRawat;
  final List<Map<String, dynamic>> potongan;
  final List<Map<String, dynamic>> items;
  const _PotonganDialog({required this.noRawat, required this.potongan, required this.items});

  @override
  State<_PotonganDialog> createState() => _PotonganDialogState();
}

class _PotonganDialogState extends State<_PotonganDialog> {
  final _nama = TextEditingController();
  final _besar = TextEditingController();
  late List<Map<String, dynamic>> _potongan = List.of(widget.potongan);
  bool _saving = false;
  bool _berubah = false;
  String? _error;

  @override
  void dispose() {
    _nama.dispose();
    _besar.dispose();
    super.dispose();
  }

  InputDecoration _deco(String hint, {String? prefix}) => InputDecoration(
        hintText: hint,
        prefixText: prefix,
        hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: _kField)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: _kField)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: _kGreen, width: 1.5)),
      );

  Future<void> _reload() async {
    try {
      final r = await BillingService.getPotongan(widget.noRawat);
      if (!mounted) return;
      setState(() => _potongan = (r['potongan'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList());
    } catch (_) {/* biarkan daftar lama */}
  }

  Future<void> _simpan() async {
    final nama = _nama.text.trim();
    final besar = double.tryParse(_besar.text.replaceAll(RegExp(r'[^\d]'), '')) ?? 0;
    if (nama.isEmpty || besar <= 0) {
      setState(() => _error = 'Isi keterangan dan besar potongan (lebih dari 0)');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await BillingService.savePotongan(noRawat: widget.noRawat, nama: nama, besar: besar);
      _berubah = true;
      _nama.clear();
      _besar.clear();
      await _reload();
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : 'Gagal menyimpan potongan');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _hapus(String nama) async {
    try {
      await BillingService.deletePotongan(noRawat: widget.noRawat, nama: nama);
      _berubah = true;
      await _reload();
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : 'Gagal menghapus potongan');
    }
  }

  void _gratiskan(Map<String, dynamic> it) {
    final nm = '${it['nm_perawatan'] ?? ''}'.trim();
    final ket = 'Gratis $nm';
    _nama.text = ket.length > 60 ? ket.substring(0, 60) : ket;
    _besar.text = ((it['totalbiaya'] as num?) ?? 0).round().toString();
    setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Potongan Biaya'),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_potongan.isNotEmpty) ...[
              const Text('Potongan saat ini', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kText)),
              const SizedBox(height: 6),
              for (final p in _potongan)
                Container(
                  decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _kLine))),
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(children: [
                    Expanded(child: Text('${p['nama'] ?? ''}', style: const TextStyle(fontSize: 15))),
                    Text('-${formatAngka((p['besar'] as num?) ?? 0)}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _kRed)),
                    IconButton(
                      tooltip: 'Hapus potongan',
                      onPressed: () => _hapus('${p['nama'] ?? ''}'),
                      icon: const Icon(Icons.delete_outline, size: 20, color: _kRed),
                    ),
                  ]),
                ),
              const SizedBox(height: 16),
            ],
            if (widget.items.isNotEmpty) ...[
              const Text('Gratiskan item', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kText)),
              const SizedBox(height: 6),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final it in widget.items)
                  ActionChip(
                    label: Text('${'${it['nm_perawatan'] ?? ''}'.trim()} · ${formatAngka((it['totalbiaya'] as num?) ?? 0)}', style: const TextStyle(fontSize: 13)),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: _kField),
                    onPressed: () => _gratiskan(it),
                  ),
              ]),
              const SizedBox(height: 16),
            ],
            const Text('Tambah potongan', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kText)),
            const SizedBox(height: 6),
            TextField(controller: _nama, maxLength: 60, decoration: _deco('Keterangan, mis. Diskon konsultasi'), style: const TextStyle(fontSize: 15)),
            const SizedBox(height: 4),
            TextField(controller: _besar, keyboardType: TextInputType.number, decoration: _deco('Besar potongan', prefix: 'Rp '), style: const TextStyle(fontSize: 15)),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(fontSize: 13, color: _kRed)),
            ],
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(_berubah), child: const Text('Tutup')),
        ElevatedButton(onPressed: _saving ? null : _simpan, child: Text(_saving ? 'Menyimpan...' : 'Simpan Potongan')),
      ],
    );
  }
}
