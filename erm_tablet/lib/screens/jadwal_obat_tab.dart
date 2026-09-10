import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/app_user.dart';
import '../models/jadwal_obat_item.dart';
import '../models/ranap_patient.dart';
import '../services/jadwal_obat_service.dart';
import '../widgets/resep_picker_sheet.dart';
import '../widgets/right_panel.dart';

const kBorder = Color(0xFFE5E7EB);
const kPrimary = Color(0xFF2563EB);
const kHeaderGreen = Color(0xFF059669);

const Map<String, TandaInfo> kTandaInfo = {
  'V': TandaInfo('Obat sudah diberikan', Color(0xFF166534), Color(0xFFDCFCE7)),
  'T': TandaInfo('Pasien menolak', Color(0xFF991B1B), Color(0xFFFEE2E2)),
  'K': TandaInfo('Kondisi pasien menyebabkan ditundanya pemberian obat', Color(0xFF92400E), Color(0xFFFEF3C7)),
  'A': TandaInfo('Reaksi alergi', Color(0xFF5B21B6), Color(0xFFEDE9FE)),
};

class TandaInfo {
  final String label;
  final Color color;
  final Color bg;
  const TandaInfo(this.label, this.color, this.bg);
}

/// JadwalObatTab — pengganti digital Formulir Pemberian Obat RM.14
/// (kertas), padanan ModalJadwalObat.tsx (web). Fitur PALING MENDESAK
/// sesuai permintaan user. Tabelnya SAMA PERSIS dgn web — Nama Obat di
/// kolom pertama, per tanggal terpilih dipecah 4 sub-kolom PG/SI/SO/ML
/// (padanan getSlotGroups() di web: slot ke-0->PG, ke-1->SI, ke-2->SO,
/// sisanya->ML) — per permintaan user, ganti dari desain kartu besar
/// V/T/K/A versi awal.
class JadwalObatTab extends StatefulWidget {
  final AppUser user;
  final RanapPatient patient;
  const JadwalObatTab({super.key, required this.user, required this.patient});

  @override
  State<JadwalObatTab> createState() => _JadwalObatTabState();
}

const List<String> kSlotLabels = ['PG', 'SI', 'SO', 'ML'];

/// getSlotGroups — padanan persis getSlotGroups() di ModalJadwalObat.tsx
/// (web): petakan tiap slot_index (0..N-1) ke salah satu dari 4 kolom
/// kertas RM.14 — slot ke-0->PG, ke-1->SI, ke-2->SO, sisanya (ke-3 dst)
/// digabung jadi satu kolom ML.
Map<String, List<int>> getSlotGroups(int jamCount) {
  final groups = {'PG': <int>[], 'SI': <int>[], 'SO': <int>[], 'ML': <int>[]};
  for (int i = 0; i < jamCount; i++) {
    if (i == 0) {
      groups['PG']!.add(i);
    } else if (i == 1) {
      groups['SI']!.add(i);
    } else if (i == 2) {
      groups['SO']!.add(i);
    } else {
      groups['ML']!.add(i);
    }
  }
  return groups;
}

class _JadwalObatTabState extends State<JadwalObatTab> {
  // _tglDari default-nya tgl_masuk pasien (bukan hari ini) — begitu tab
  // dibuka, riwayat jadwal obat SEJAK MASUK RANAP langsung kelihatan,
  // tidak perlu geser tanggal manual dulu.
  late DateTime _tglDari;
  DateTime _tglSampai = DateTime.now();
  bool _loading = true;
  List<JadwalObatItem> _items = [];
  List<FrekuensiRef> _frekuensiRef = [];

  String get _dariStr => DateFormat('yyyy-MM-dd').format(_tglDari);
  String get _sampaiStr => DateFormat('yyyy-MM-dd').format(_tglSampai);

  /// Padanan getDateRange() di web — daftar tanggal dari _tglDari s/d
  /// _tglSampai (inklusif), dibatasi max 31 hari sbg pengaman.
  List<String> get _dates {
    final result = <String>[];
    var d = DateTime(_tglDari.year, _tglDari.month, _tglDari.day);
    final end = DateTime(_tglSampai.year, _tglSampai.month, _tglSampai.day);
    var guard = 0;
    while (!d.isAfter(end) && guard < 31) {
      result.add(DateFormat('yyyy-MM-dd').format(d));
      d = d.add(const Duration(days: 1));
      guard++;
    }
    return result;
  }

  String get _currentUsername => widget.user.role == 'dokter' ? widget.user.kdDokter : widget.user.username;

  @override
  void initState() {
    super.initState();
    _tglDari = _parseTglMasuk(widget.patient.tglMasuk);
    if (_tglDari.isAfter(_tglSampai)) _tglSampai = _tglDari; // jaga-jaga kalau tgl_masuk anehnya di masa depan
    _loadFrekuensiRef();
    _load();
  }

  DateTime _parseTglMasuk(String tglMasuk) {
    try {
      if (tglMasuk.isEmpty) return DateTime.now();
      return DateFormat('yyyy-MM-dd').parseStrict(tglMasuk);
    } catch (_) {
      return DateTime.now();
    }
  }

  Future<void> _loadFrekuensiRef() async {
    try {
      final list = await JadwalObatService.getFrekuensiRef();
      if (mounted) setState(() => _frekuensiRef = list);
    } catch (_) {/* diam, dropdown Frekuensi kosong kalau gagal */}
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await JadwalObatService.getList(widget.patient.noRawat, _dariStr, _sampaiStr);
      if (!mounted) return;
      setState(() {
        _items = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gagal mengambil jadwal obat'), backgroundColor: Color(0xFFDC2626)));
    }
  }

  Future<void> _pickTglDari() async {
    final picked = await showDatePicker(context: context, initialDate: _tglDari, firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (picked == null) return;
    setState(() => _tglDari = picked);
    _load();
  }

  Future<void> _pickTglSampai() async {
    final picked = await showDatePicker(context: context, initialDate: _tglSampai, firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (picked == null) return;
    setState(() => _tglSampai = picked);
    _load();
  }

  Future<void> _openTambahObat() async {
    // Landscape: panel geser dari kanan (40% layar, konsisten dgn Filter
    // Rawat Inap); portrait: tetap AlertDialog spt semula.
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
    _TambahObatResult? result;
    if (isLandscape) {
      result = await showRightPanel<_TambahObatResult>(
        context,
        builder: (_) => _TambahObatDialog(frekuensiRef: _frekuensiRef, noRawat: widget.patient.noRawat, asPanel: true),
      );
    } else {
      result = await showDialog<_TambahObatResult>(
        context: context,
        builder: (_) => _TambahObatDialog(frekuensiRef: _frekuensiRef, noRawat: widget.patient.noRawat, asPanel: false),
      );
    }
    if (result == null) return;
    try {
      await JadwalObatService.tambah(
        noRawat: widget.patient.noRawat,
        namaObat: result.namaObat,
        sumber: result.sumber,
        frekuensi: result.frekuensi,
        tglMulai: DateFormat('yyyy-MM-dd').format(DateTime.now()),
        createdBy: _currentUsername,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Obat berhasil ditambahkan'), backgroundColor: Color(0xFF16A34A)));
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal: $e'), backgroundColor: const Color(0xFFDC2626)));
    }
  }

  Future<void> _hentikanObat(JadwalObatItem item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hentikan obat ini?'),
        content: Text('${item.namaObat} tidak akan muncul lagi di jadwal aktif. Histori tanda tetap tersimpan.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Hentikan', style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await JadwalObatService.hentikan(item.id);
      if (mounted) _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal: $e'), backgroundColor: const Color(0xFFDC2626)));
    }
  }

  Future<void> _openTandaSheet(JadwalObatItem item, String tanggal, int slotIndex, String jam) async {
    final existing = item.tandaAt(tanggal, slotIndex);
    final result = await showModalBottomSheet<_TandaResult>(
      context: context,
      builder: (_) => _TandaSheet(jam: jam, namaObat: item.namaObat, existing: existing),
    );
    if (result == null) return;
    try {
      if (result.hapus) {
        await JadwalObatService.hapusTanda(jadwalObatId: item.id, tanggal: tanggal, slotIndex: slotIndex);
      } else {
        await JadwalObatService.tandai(
          jadwalObatId: item.id,
          tanggal: tanggal,
          slotIndex: slotIndex,
          tanda: result.tanda!,
          catatan: result.catatan,
          markedBy: _currentUsername,
        );
      }
      if (mounted) _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal: $e'), backgroundColor: const Color(0xFFDC2626)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final aktif = _items.where((it) => it.status == 'aktif').toList();
    final dihentikan = _items.where((it) => it.status != 'aktif').toList();

    // Scaffold internal (bersarang di dalam Scaffold layar Jadwal Obat) —
    // cuma supaya bisa punya floatingActionButton "Tambah Obat" sendiri,
    // background transparan, tidak menambah AppBar/dsb.
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openTambahObat,
        backgroundColor: kHeaderGreen,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Tambah Obat'),
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kBorder))),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                _dateField('Dari', _tglDari, _pickTglDari),
                _dateField('Sampai', _tglSampai, _pickTglSampai),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Wrap(
              spacing: 12,
              children: kTandaInfo.entries.map((e) => Text('${e.key} = ${e.value.label}', style: TextStyle(fontSize: 10, color: e.value.color))).toList(),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : (aktif.isEmpty && dihentikan.isEmpty)
                    ? const Center(child: Text('Belum ada obat terjadwal untuk pasien ini.', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))))
                    : _JadwalObatTable(
                        aktif: aktif,
                        dihentikan: dihentikan,
                        dates: _dates,
                        onTapSlot: (item, tanggal, idx, jam) => _openTandaSheet(item, tanggal, idx, jam),
                        onHentikan: _hentikanObat,
                      ),
          ),
        ],
      ),
    );
  }

  Widget _dateField(String label, DateTime value, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(4)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('$label: ', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
            Text(DateFormat('d MMM yyyy', 'id_ID').format(value), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(width: 4),
            const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF6B7280)),
          ],
        ),
      ),
    );
  }
}

/// _JadwalObatTable — tabel Nama Obat x tanggal (tiap tanggal dipecah 4
/// sub-kolom PG/SI/SO/ML), padanan persis JadwalObatTable di
/// ModalJadwalObat.tsx (web). Dibangun manual pakai Row/Column (bukan
/// widget Table) krn butuh header 2-baris (tanggal membentang 4 kolom) —
/// Table Flutter tidak dukung colSpan.
class _JadwalObatTable extends StatelessWidget {
  final List<JadwalObatItem> aktif;
  final List<JadwalObatItem> dihentikan;
  final List<String> dates;
  final void Function(JadwalObatItem item, String tanggal, int slotIndex, String jam) onTapSlot;
  final void Function(JadwalObatItem item) onHentikan;
  const _JadwalObatTable({required this.aktif, required this.dihentikan, required this.dates, required this.onTapSlot, required this.onHentikan});

  static const double _namaColWidth = 190;
  static const double _slotColWidth = 46;
  double get _dateGroupWidth => _slotColWidth * 4;

  @override
  Widget build(BuildContext context) {
    final naturalWidth = _namaColWidth + _dateGroupWidth * dates.length;
    return LayoutBuilder(
      builder: (context, constraints) {
        // Tabel langsung selebar layar (padding 16 kiri-kanan) kalau
        // isinya pendek — begitu isinya lebih panjang dr layar (banyak
        // tanggal), baru scroll horizontal (bukan menyempitkan kolom).
        final tableWidth = naturalWidth > constraints.maxWidth - 32 ? naturalWidth : constraints.maxWidth - 32;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Container(
              width: tableWidth,
              decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(8)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _headerRow1(),
                  _headerRow2(),
                  for (final item in aktif) _obatRow(item, readOnly: false),
                  if (dihentikan.isNotEmpty) _dividerRow(tableWidth),
                  for (final item in dihentikan) _obatRow(item, readOnly: true),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _headerRow1() {
    return Container(
      decoration: const BoxDecoration(color: Color(0xFFF9FAFB), border: Border(bottom: BorderSide(color: kBorder))),
      child: Row(
        children: [
          Container(
            width: _namaColWidth,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            alignment: Alignment.center,
            child: const Text('Nama Obat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
          ),
          for (final date in dates)
            Container(
              width: _dateGroupWidth,
              padding: const EdgeInsets.symmetric(vertical: 6),
              alignment: Alignment.center,
              decoration: const BoxDecoration(border: Border(left: BorderSide(color: kBorder))),
              child: Text(_fmtTglIndo(date), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
            ),
        ],
      ),
    );
  }

  Widget _headerRow2() {
    return Container(
      decoration: const BoxDecoration(color: Color(0xFFF9FAFB), border: Border(bottom: BorderSide(color: kBorder))),
      child: Row(
        children: [
          SizedBox(width: _namaColWidth),
          for (final _ in dates)
            Row(
              children: kSlotLabels
                  .map((l) => Container(
                        width: _slotColWidth,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(border: Border(left: BorderSide(color: kBorder))),
                        child: Text(l, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                      ))
                  .toList(),
            ),
        ],
      ),
    );
  }

  Widget _dividerRow(double width) {
    return Container(
      width: width,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      color: const Color(0xFFF3F4F6),
      child: const Text('Obat Dihentikan', style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
    );
  }

  Widget _obatRow(JadwalObatItem item, {required bool readOnly}) {
    return Opacity(
      opacity: readOnly ? 0.55 : 1,
      child: Container(
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kBorder))),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: _namaColWidth,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      Text(item.namaObat, style: const TextStyle(fontSize: 12, color: Color(0xFF111827))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(color: const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(999)),
                        child: Text(item.frekuensi, style: const TextStyle(fontSize: 9, color: Color(0xFF1E40AF), fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                  if (!readOnly) ...[
                    const SizedBox(height: 4),
                    InkWell(
                      onTap: () => onHentikan(item),
                      child: const Text('Hentikan', style: TextStyle(fontSize: 10, color: Color(0xFFDC2626))),
                    ),
                  ],
                ],
              ),
            ),
            for (final date in dates)
              Row(
                children: () {
                  final groups = getSlotGroups(item.jamList.length);
                  return kSlotLabels.map((label) {
                    final slotIndexes = groups[label]!;
                    return Container(
                      width: _slotColWidth,
                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(border: Border(left: BorderSide(color: kBorder))),
                      child: slotIndexes.isEmpty
                          ? const Text('–', style: TextStyle(fontSize: 11, color: Color(0xFFE5E7EB)))
                          : Wrap(
                              alignment: WrapAlignment.center,
                              spacing: 3,
                              runSpacing: 3,
                              children: slotIndexes.map((slotIndex) {
                                final jam = item.jamList[slotIndex];
                                final cell = item.tandaAt(date, slotIndex);
                                final info = cell != null ? kTandaInfo[cell.tanda] : null;
                                return InkWell(
                                  onTap: readOnly ? null : () => onTapSlot(item, date, slotIndex, jam),
                                  borderRadius: BorderRadius.circular(999),
                                  child: Container(
                                    width: 26,
                                    height: 26,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: info?.bg ?? Colors.white,
                                      border: Border.all(color: info?.color ?? const Color(0xFFD1D5DB)),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Text(cell?.tanda ?? '', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: info?.color ?? const Color(0xFFD1D5DB))),
                                  ),
                                );
                              }).toList(),
                            ),
                    );
                  }).toList();
                }(),
              ),
          ],
        ),
      ),
    );
  }

  String _fmtTglIndo(String tgl) {
    final parts = tgl.split('-');
    if (parts.length != 3) return tgl;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}

class _TambahObatResult {
  final String namaObat;
  final String frekuensi;
  final String sumber;
  _TambahObatResult(this.namaObat, this.frekuensi, this.sumber);
}

/// _TambahObatDialog — dua sumber isian, padanan persis toggle
/// "Ketik Manual" / "Dari Resep" di ModalJadwalObat.tsx (web): "Dari Resep"
/// buka [showResepPickerSheet] yg nampilin detail LENGKAP semua resep
/// pasien ini (bukan cuma nama obat) — tgl/jam/dokter, jumlah+satuan+
/// aturan pakai tiap item, dan kandungan racikan. Nama Obat & Frekuensi
/// tetap bisa diedit manual setelah dipilih, tidak mengunci form.
class _TambahObatDialog extends StatefulWidget {
  final List<FrekuensiRef> frekuensiRef;
  final String noRawat;
  final bool asPanel;
  const _TambahObatDialog({required this.frekuensiRef, required this.noRawat, required this.asPanel});

  @override
  State<_TambahObatDialog> createState() => _TambahObatDialogState();
}

class _TambahObatDialogState extends State<_TambahObatDialog> {
  final _namaCtrl = TextEditingController();
  String? _frekuensi;
  String _sumber = 'manual';

  @override
  void dispose() {
    _namaCtrl.dispose();
    super.dispose();
  }

  Future<void> _pilihDariResep() async {
    final picked = await showResepPickerSheet(context, noRawat: widget.noRawat);
    if (picked == null) return;
    setState(() {
      _namaCtrl.text = picked.namaObat;
      _sumber = 'resep';
      final guess = detectFrekuensiFromAturanPakai(picked.aturanPakai, widget.frekuensiRef.map((f) => f.frekuensi).toList());
      if (guess.isNotEmpty) _frekuensi = guess;
    });
  }

  @override
  Widget build(BuildContext context) {
    final jamPreview = widget.frekuensiRef.where((f) => f.frekuensi == _frekuensi).map((f) => f.jamList.join(', ')).firstOrNull;
    final fields = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _pilihDariResep,
            icon: const Icon(Icons.medication_liquid_outlined, size: 16),
            label: const Text('Pilih dari Resep'),
            style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 10)),
          ),
        ),
        const SizedBox(height: 12),
        const Text('Nama Obat', style: TextStyle(fontSize: 12, color: Color(0xFF374151))),
        const SizedBox(height: 4),
        TextField(
          controller: _namaCtrl,
          decoration: const InputDecoration(isDense: true, hintText: 'Nama obat oral/topikal', border: OutlineInputBorder()),
          onChanged: (_) => _sumber = 'manual',
        ),
        const SizedBox(height: 12),
        const Text('Frekuensi', style: TextStyle(fontSize: 12, color: Color(0xFF374151))),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          value: _frekuensi,
          decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
          items: widget.frekuensiRef.map((f) => DropdownMenuItem(value: f.frekuensi, child: Text(f.frekuensi))).toList(),
          onChanged: (v) => setState(() => _frekuensi = v),
        ),
        if (jamPreview != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Jam: $jamPreview', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))),
      ],
    );

    void doSimpan() {
      if (_namaCtrl.text.trim().isEmpty || _frekuensi == null) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nama obat & frekuensi wajib diisi')));
        return;
      }
      Navigator.of(context).pop(_TambahObatResult(_namaCtrl.text.trim(), _frekuensi!, _sumber));
    }

    if (widget.asPanel) {
      return Material(
        color: Colors.white,
        elevation: 8,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(child: Text('Tambah Obat', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
                    IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.of(context).pop(), padding: EdgeInsets.zero, constraints: const BoxConstraints(), visualDensity: VisualDensity.compact),
                  ],
                ),
                const SizedBox(height: 16),
                Expanded(child: SingleChildScrollView(child: fields)),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Batal'))),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: doSimpan,
                        style: ElevatedButton.styleFrom(backgroundColor: kPrimary, foregroundColor: Colors.white),
                        child: const Text('Simpan'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }

    return AlertDialog(
      title: const Text('Tambah Obat'),
      content: SizedBox(width: 360, child: fields),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Batal')),
        ElevatedButton(
          onPressed: doSimpan,
          style: ElevatedButton.styleFrom(backgroundColor: kPrimary, foregroundColor: Colors.white),
          child: const Text('Simpan'),
        ),
      ],
    );
  }
}

class _TandaResult {
  final String? tanda;
  final String catatan;
  final bool hapus;
  _TandaResult({this.tanda, this.catatan = '', this.hapus = false});
}

class _TandaSheet extends StatefulWidget {
  final String jam;
  final String namaObat;
  final TandaCell? existing;
  const _TandaSheet({required this.jam, required this.namaObat, this.existing});

  @override
  State<_TandaSheet> createState() => _TandaSheetState();
}

class _TandaSheetState extends State<_TandaSheet> {
  String? _tanda;
  final _catatanCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tanda = widget.existing?.tanda;
    _catatanCtrl.text = widget.existing?.catatan ?? '';
  }

  @override
  void dispose() {
    _catatanCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${widget.namaObat} — ${widget.jam}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('Tandai pemberian obat:', style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 12),
          Row(
            children: kTandaInfo.entries.map((e) {
              final selected = _tanda == e.key;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: InkWell(
                    onTap: () => setState(() => _tanda = e.key),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: selected ? e.value.bg : Colors.white,
                        border: Border.all(color: selected ? e.value.color : kBorder, width: selected ? 2 : 1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(e.key, textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: selected ? e.value.color : const Color(0xFF9CA3AF))),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          if (_tanda != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(kTandaInfo[_tanda]!.label, style: TextStyle(fontSize: 11, color: kTandaInfo[_tanda]!.color))),
          const SizedBox(height: 12),
          TextField(
            controller: _catatanCtrl,
            decoration: const InputDecoration(labelText: 'Catatan (opsional)', isDense: true, border: OutlineInputBorder()),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: _tanda == null ? null : () => Navigator.of(context).pop(_TandaResult(tanda: _tanda, catatan: _catatanCtrl.text.trim())),
                  style: ElevatedButton.styleFrom(backgroundColor: kPrimary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 12)),
                  child: const Text('Simpan'),
                ),
              ),
              if (widget.existing != null) ...[
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(_TandaResult(hapus: true)),
                  style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626), side: const BorderSide(color: Color(0xFFFECACA)), padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16)),
                  child: const Text('Hapus'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
