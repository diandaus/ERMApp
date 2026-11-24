import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/soap_item.dart';
import '../services/soap_ralan_service.dart';
import '../theme/app_theme.dart';

/// Panel "Riwayat SOAPIE" — padanan RiwayatSoapieModal.tsx (web), dibuka
/// dari tombol SOAPIE di form SOAP/CPPT Poliklinik. Panel geser dari kanan
/// (gaya sama dgn panel Input Resep): navbar tosca, filter (5 Kunjungan
/// Terakhir / Semua / Berdasarkan Tanggal / No. Rawat Tertentu), daftar
/// SOAPIE per kunjungan. Tombol Copy -> panel ditutup & mengembalikan
/// [SoapItem] terpilih ke pemanggil utk diisikan ke form.
Future<SoapItem?> showRiwayatSoapiePanel(BuildContext context, {required String noRkmMedis, required String nmPasien}) {
  return showGeneralDialog<SoapItem>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Riwayat SOAPIE',
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, _, __) => Align(
      alignment: Alignment.centerRight,
      child: FractionallySizedBox(
        widthFactor: 0.6,
        heightFactor: 1,
        child: _RiwayatSoapiePanel(noRkmMedis: noRkmMedis, nmPasien: nmPasien),
      ),
    ),
    transitionBuilder: (context, anim, __, child) => SlideTransition(
      position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
      child: child,
    ),
  );
}

const _kCardBorder = Color(0xFFCFD1D1);

const _kFilter = {
  'last5': '5 Kunjungan Terakhir',
  'all': 'Semua Kunjungan',
  'dateRange': 'Berdasarkan Tanggal',
  'specific': 'No. Rawat Tertentu',
};

class _RiwayatSoapiePanel extends StatefulWidget {
  final String noRkmMedis;
  final String nmPasien;
  const _RiwayatSoapiePanel({required this.noRkmMedis, required this.nmPasien});

  @override
  State<_RiwayatSoapiePanel> createState() => _RiwayatSoapiePanelState();
}

class _RiwayatSoapiePanelState extends State<_RiwayatSoapiePanel> {
  String _filter = 'last5';
  DateTime _dari = DateTime.now();
  DateTime _sampai = DateTime.now();
  final _noRawatCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  List<SoapieKunjungan> _data = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _noRawatCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (_filter == 'specific' && _noRawatCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Silakan masukkan No. Rawat');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final fmt = DateFormat('yyyy-MM-dd');
      final data = await SoapRalanService.getRiwayatSoapie(
        widget.noRkmMedis,
        filter: _filter,
        dateFrom: fmt.format(_dari),
        dateTo: fmt.format(_sampai),
        noRawat: _noRawatCtrl.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _data = const [];
        _error = 'Gagal mengambil riwayat SOAPIE';
        _loading = false;
      });
    }
  }

  Future<void> _pilihTanggal(bool dari) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: dari ? _dari : _sampai,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked == null) return;
    setState(() => dari ? _dari = picked : _sampai = picked);
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Material(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Navbar tosca — tinggi isi 60 (+ status bar), sama dgn navbar lain.
          Container(
            color: kPrimary,
            height: top + 60,
            padding: EdgeInsets.fromLTRB(16, top, 12, 0),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  child: const Icon(Icons.history_edu, size: 22, color: kPrimaryDark),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Riwayat SOAPIE', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                      const SizedBox(height: 3),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                        child: Text('${widget.nmPasien} · No. RM ${widget.noRkmMedis}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: kText)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Tutup',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close, color: Colors.white, size: 24),
                ),
              ],
            ),
          ),
          _buildFilter(),
          Expanded(
            child: Container(
              color: kBg,
              child: _buildList(),
            ),
          ),
        ],
      ),
    );
  }

  /// Baris filter putih setinggi 48 — dropdown filter (gaya "Jenis Order")
  /// + input tambahan sesuai jenis filter + tombol Cari.
  Widget _buildFilter() {
    final perluCari = _filter == 'dateRange' || _filter == 'specific';
    final fmt = DateFormat('d MMM yyyy', 'id_ID');
    Widget tanggal(String label, DateTime v, VoidCallback onTap) => InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            decoration: const BoxDecoration(border: Border(left: BorderSide(color: kLine))),
            child: Row(children: [
              Text('$label ', style: const TextStyle(fontSize: 13, color: kTextMuted)),
              Text(fmt.format(v), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kText)),
              const SizedBox(width: 6),
              const Icon(Icons.calendar_today_outlined, size: 15, color: kTextMuted),
            ]),
          ),
        );
    return Container(
      height: 48,
      decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: kLine))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PopupMenuButton<String>(
            tooltip: 'Filter',
            position: PopupMenuPosition.under,
            onSelected: (v) {
              setState(() => _filter = v);
              if (v == 'last5' || v == 'all') _load();
            },
            itemBuilder: (_) => _kFilter.entries
                .map((e) => PopupMenuItem<String>(
                      value: e.key,
                      child: Row(children: [
                        SizedBox(width: 22, child: e.key == _filter ? const Icon(Icons.check, size: 18, color: kPrimaryDark) : null),
                        const SizedBox(width: 6),
                        Text(e.value, style: TextStyle(fontSize: 14, fontWeight: e.key == _filter ? FontWeight.w600 : FontWeight.w400, color: e.key == _filter ? kPrimaryDark : kText)),
                      ]),
                    ))
                .toList(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                Text(_kFilter[_filter]!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kPrimaryDark)),
                const SizedBox(width: 6),
                const Icon(Icons.arrow_drop_down, size: 26, color: kPrimaryDark),
              ]),
            ),
          ),
          if (_filter == 'dateRange') ...[
            tanggal('Dari', _dari, () => _pilihTanggal(true)),
            tanggal('Sampai', _sampai, () => _pilihTanggal(false)),
          ],
          if (_filter == 'specific')
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                alignment: Alignment.center,
                decoration: const BoxDecoration(border: Border(left: BorderSide(color: kLine))),
                child: TextField(
                  controller: _noRawatCtrl,
                  onSubmitted: (_) => _load(),
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'No. Rawat, mis. 2026/04/13/000003',
                    hintStyle: TextStyle(fontSize: 13, color: kTextMuted),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
            )
          else
            const Spacer(),
          if (perluCari)
            InkWell(
              onTap: _loading ? null : _load,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                color: kPrimary,
                alignment: Alignment.center,
                child: const Row(children: [
                  Icon(Icons.search, size: 20, color: Colors.white),
                  SizedBox(width: 6),
                  Text('Cari', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                ]),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildList() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!, style: const TextStyle(fontSize: 13, color: Color(0xFFDC2626))));
    final ada = _data.where((k) => k.soapie.isNotEmpty).toList();
    if (ada.isEmpty) {
      return const Center(child: Text('Belum ada riwayat SOAPIE pada filter ini', style: TextStyle(fontSize: 13, color: kTextMuted)));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [for (final k in ada) _kunjunganCard(k)],
    );
  }

  Widget _kunjunganCard(SoapieKunjungan k) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kCardBorder), borderRadius: BorderRadius.circular(6)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kLine))),
            child: Row(children: [
              Text(k.noRawat, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: kText)),
              const SizedBox(width: 10),
              Text(soapTanggal(k.tglRegistrasi), style: const TextStyle(fontSize: 13, color: kTextMuted)),
              const Spacer(),
              if (k.statusLanjut.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: kPrimarySoft, borderRadius: BorderRadius.circular(999)),
                  child: Text(k.statusLanjut == 'Ranap' ? 'Rawat Inap' : 'Rawat Jalan', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kPrimaryDark)),
                ),
            ]),
          ),
          for (var i = 0; i < k.soapie.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: kLine),
            _soapieItem(k.soapie[i]),
          ],
        ],
      ),
    );
  }

  Widget _soapieItem(SoapItem s) {
    Widget baris(String label, String isi) => isi.trim().isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: '$label: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                TextSpan(text: isi),
              ]),
              style: const TextStyle(fontSize: 13, height: 1.4, color: kText),
            ),
          );
    final ttv = [
      if (s.tensi.isNotEmpty) 'TD ${s.tensi}',
      if (s.nadi.isNotEmpty) 'Nadi ${s.nadi}',
      if (s.suhuTubuh.isNotEmpty) 'Suhu ${s.suhuTubuh}°C',
      if (s.respirasi.isNotEmpty) 'RR ${s.respirasi}',
      if (s.spo2.isNotEmpty) 'SpO2 ${s.spo2}',
      if (s.gcs.isNotEmpty) 'GCS ${s.gcs}',
      if (s.tinggi.isNotEmpty) 'TB ${s.tinggi} cm',
      if (s.berat.isNotEmpty) 'BB ${s.berat} kg',
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text(
                '${soapTanggal(s.tglPerawatan)} ${s.jamRawat}  ·  ${s.nama.isEmpty ? s.nip : s.nama}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kText),
              ),
            ),
            InkWell(
              onTap: () => Navigator.of(context).pop(s),
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: kPrimary, borderRadius: BorderRadius.circular(6)),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.copy_outlined, size: 15, color: Colors.white),
                  SizedBox(width: 6),
                  Text('Copy', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                ]),
              ),
            ),
          ]),
          if (ttv.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(ttv, style: const TextStyle(fontSize: 12, color: kTextMuted))),
          baris('S', s.keluhan),
          baris('O', s.pemeriksaan),
          baris('A', s.penilaian),
          baris('P', s.rtl),
          baris('I', s.instruksi),
          baris('E', s.evaluasi),
          baris('Alergi', s.alergi),
        ],
      ),
    );
  }
}

/// Tanggal dari API bisa ISO ("2026-04-13T00:00:00+07:00") atau sudah
/// dd/MM/yyyy — tampilkan dd/MM/yyyy.
String soapTanggal(String raw) {
  if (raw.length >= 10 && raw[4] == '-') {
    return '${raw.substring(8, 10)}/${raw.substring(5, 7)}/${raw.substring(0, 4)}';
  }
  return raw.isEmpty ? '-' : raw;
}
