import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/app_user.dart';
import '../models/dokter_option.dart';
import '../models/ranap_patient.dart';
import '../services/dokter_service.dart';
import '../services/ranap_service.dart';
import 'pasien_detail_landscape_screen.dart';

const kBorder = Color(0xFFE5E7EB);
const kSidebarGreen = Color(0xFF059669);

/// RanapTableScreen — versi LANDSCAPE dari daftar pasien Rawat Inap,
/// gaya tabel data (padanan contoh referensi user: "Doctors List" —
/// judul besar rata kiri, toolbar rata kanan, baris data selang-seling),
/// BEDA dari RanapListScreen (portrait, kartu + header hijau + kolom
/// cari) yg TETAP dipakai apa adanya di portrait — sengaja file terpisah
/// spy desain kartu portrait yg sudah teriterasi tidak ikut kesenggol.
/// Kolom cari card/header SENGAJA dihapus di sini per arahan user — kolom
/// cari yg dipakai justru kolom cari NAVBAR ATAS landscape (LandscapeShell/
/// _TopBar), diteruskan lewat [searchQuery] krn cakupan pencariannya ikut
/// tab aktif (skrg baru Rawat Inap yg fungsional). Endpoint SAMA PERSIS
/// (RanapService.getList/rawat-inap/list), tidak ada endpoint baru.
class RanapTableScreen extends StatefulWidget {
  final AppUser user;
  final VoidCallback onLogout;
  final String searchQuery;
  const RanapTableScreen({super.key, required this.user, required this.onLogout, this.searchQuery = ''});

  @override
  State<RanapTableScreen> createState() => _RanapTableScreenState();
}

class _RanapTableScreenState extends State<RanapTableScreen> {
  bool _loading = true;
  String? _error;
  List<RanapPatient> _list = [];
  String _status = 'belum-pulang';

  // Filter — diterapkan client-side ke _list yg sudah kepanggil (bukan
  // param baru ke backend), krn cuma dua kriteria sederhana (rentang tgl
  // masuk + substring nama DPJP) dan datanya per-status sudah kepanggil
  // semua sekali load.
  DateTime? _filterTglDari;
  DateTime? _filterTglSampai;
  String _filterDpjp = '';
  List<DokterOption> _dokterList = [];

  bool get _filterActive => _filterTglDari != null || _filterTglSampai != null || _filterDpjp.trim().isNotEmpty;

  List<RanapPatient> get _filteredList {
    final q = widget.searchQuery.trim().toLowerCase();
    return _list.where((p) {
      if (_filterTglDari != null || _filterTglSampai != null) {
        final tgl = DateTime.tryParse(p.tglMasuk);
        if (tgl == null) return false;
        if (_filterTglDari != null && tgl.isBefore(DateTime(_filterTglDari!.year, _filterTglDari!.month, _filterTglDari!.day))) return false;
        if (_filterTglSampai != null && tgl.isAfter(DateTime(_filterTglSampai!.year, _filterTglSampai!.month, _filterTglSampai!.day, 23, 59, 59))) return false;
      }
      if (_filterDpjp.trim().isNotEmpty && !p.nmDokter.toLowerCase().contains(_filterDpjp.trim().toLowerCase())) return false;
      if (q.isNotEmpty) {
        final haystack = '${p.noRkmMedis} ${p.nmPasien} ${p.nmDokter} ${p.kamar} ${p.diagnosaAwal} ${p.pngJawab}'.toLowerCase();
        if (!haystack.contains(q)) return false;
      }
      return true;
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _load();
    _loadDokterList();
  }

  Future<void> _loadDokterList() async {
    try {
      final list = await DokterService.getList();
      if (mounted) setState(() => _dokterList = list);
    } catch (_) {/* diam, combobox DPJP kosong kalau gagal */}
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await RanapService.getList(widget.user, status: _status);
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil data pasien rawat inap';
        _loading = false;
      });
    }
  }

  /// _openFilterPanel — panel geser dari kanan, lebar 20% layar, per
  /// arahan user. Isi: rentang Tanggal Masuk (Dari/Sampai) + DPJP.
  Future<void> _openFilterPanel() async {
    final result = await showGeneralDialog<_FilterResult>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Filter',
      barrierColor: Colors.black38,
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (context, _, __) {
        return Align(
          alignment: Alignment.centerRight,
          child: SizedBox(
            width: MediaQuery.of(context).size.width * 0.2,
            height: double.infinity,
            child: _FilterPanel(initialDari: _filterTglDari, initialSampai: _filterTglSampai, initialDpjp: _filterDpjp, dokterList: _dokterList),
          ),
        );
      },
      transitionBuilder: (context, anim, __, child) {
        return SlideTransition(
          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
          child: child,
        );
      },
    );
    if (result == null || !mounted) return;
    setState(() {
      _filterTglDari = result.tglDari;
      _filterTglSampai = result.tglSampai;
      _filterDpjp = result.dpjp;
    });
  }

  void _openDetail(RanapPatient patient) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PasienDetailLandscapeScreen(user: widget.user, patient: patient),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF9FAFB),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Spacer(),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'belum-pulang', label: Text('Belum Pulang', style: TextStyle(fontSize: 12))),
                    ButtonSegment(value: 'sudah-pulang', label: Text('Sudah Pulang', style: TextStyle(fontSize: 12))),
                  ],
                  selected: {_status},
                  onSelectionChanged: (s) {
                    setState(() => _status = s.first);
                    _load();
                  },
                ),
                const SizedBox(width: 8),
                _FilterButton(active: _filterActive, onPressed: _openFilterPanel),
                const SizedBox(width: 8),
                IconButton(icon: const Icon(Icons.refresh), tooltip: 'Muat ulang', onPressed: _load),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))))
                      : _filteredList.isEmpty
                          ? const Center(child: Text('Tidak ada pasien', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))))
                          : _PatientTable(list: _filteredList, onTapRow: _openDetail, showTglPulang: _status == 'sudah-pulang'),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  final bool active;
  final VoidCallback onPressed;
  const _FilterButton({required this.active, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(Icons.filter_alt_outlined, size: 16, color: active ? kSidebarGreen : const Color(0xFF6B7280)),
      label: Text('Filter', style: TextStyle(fontSize: 12, color: active ? kSidebarGreen : const Color(0xFF374151))),
      style: OutlinedButton.styleFrom(side: BorderSide(color: active ? kSidebarGreen : kBorder)),
    );
  }
}

class _FilterResult {
  final DateTime? tglDari;
  final DateTime? tglSampai;
  final String dpjp;
  _FilterResult({this.tglDari, this.tglSampai, required this.dpjp});
}

/// _FilterPanel — isi modal filter (Tanggal Masuk Dari/Sampai + DPJP),
/// dipanggil dari [_RanapTableScreenState._openFilterPanel] lewat
/// showGeneralDialog. Filter diterapkan client-side, lihat komentar
/// _filteredList.
class _FilterPanel extends StatefulWidget {
  final DateTime? initialDari;
  final DateTime? initialSampai;
  final String initialDpjp;
  final List<DokterOption> dokterList;
  const _FilterPanel({required this.initialDari, required this.initialSampai, required this.initialDpjp, required this.dokterList});

  @override
  State<_FilterPanel> createState() => _FilterPanelState();
}

class _FilterPanelState extends State<_FilterPanel> {
  DateTime? _tglDari;
  DateTime? _tglSampai;
  String _dpjpText = '';
  // Ditangkap dari fieldViewBuilder Autocomplete supaya tombol Reset bisa
  // ikut mengosongkan teksnya (Autocomplete kelola controller sendiri,
  // tidak bisa dikasih controller eksternal langsung).
  TextEditingController? _dpjpFieldCtrl;

  @override
  void initState() {
    super.initState();
    _tglDari = widget.initialDari;
    _tglSampai = widget.initialSampai;
    _dpjpText = widget.initialDpjp;
  }

  Future<void> _pickDari() async {
    final picked = await showDatePicker(context: context, initialDate: _tglDari ?? DateTime.now(), firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (picked != null) setState(() => _tglDari = picked);
  }

  Future<void> _pickSampai() async {
    final picked = await showDatePicker(context: context, initialDate: _tglSampai ?? DateTime.now(), firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (picked != null) setState(() => _tglSampai = picked);
  }

  @override
  Widget build(BuildContext context) {
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
                  const Expanded(child: Text('Filter', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
                  IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.of(context).pop(), padding: EdgeInsets.zero, constraints: const BoxConstraints(), visualDensity: VisualDensity.compact),
                ],
              ),
              const SizedBox(height: 20),
              const Text('Tanggal Masuk', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
              const SizedBox(height: 8),
              _dateField('Dari', _tglDari, _pickDari, onClear: _tglDari == null ? null : () => setState(() => _tglDari = null)),
              const SizedBox(height: 8),
              _dateField('Sampai', _tglSampai, _pickSampai, onClear: _tglSampai == null ? null : () => setState(() => _tglSampai = null)),
              const SizedBox(height: 20),
              const Text('DPJP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
              const SizedBox(height: 8),
              // Autocomplete — optionsBuilder balikin SEMUA dokter begitu
              // query kosong (bukan cuma stlh mulai mengetik), jadi begitu
              // kolom ini difokuskan langsung tampil combobox berisi semua
              // dokter, per arahan user.
              Autocomplete<DokterOption>(
                initialValue: TextEditingValue(text: _dpjpText),
                displayStringForOption: (d) => d.nmDokter,
                optionsBuilder: (TextEditingValue tev) {
                  final q = tev.text.trim().toLowerCase();
                  if (q.isEmpty) return widget.dokterList;
                  return widget.dokterList.where((d) => d.nmDokter.toLowerCase().contains(q));
                },
                onSelected: (d) => setState(() => _dpjpText = d.nmDokter),
                fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                  _dpjpFieldCtrl = controller;
                  return TextField(
                    controller: controller,
                    focusNode: focusNode,
                    onChanged: (v) => _dpjpText = v,
                    decoration: const InputDecoration(isDense: true, hintText: 'Nama dokter...', border: OutlineInputBorder()),
                    style: const TextStyle(fontSize: 13),
                  );
                },
                // Lebar daftar combobox DISAMAKAN dgn lebar kolom cari
                // (panel filter dikurangi padding 16 kiri-kanan) — default
                // Autocomplete tidak otomatis mengikuti lebar field.
                optionsViewBuilder: (context, onSelected, options) {
                  return Align(
                    alignment: Alignment.topLeft,
                    child: Material(
                      elevation: 4,
                      borderRadius: BorderRadius.circular(6),
                      child: SizedBox(
                        width: MediaQuery.of(context).size.width * 0.2 - 32,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 240),
                          child: ListView.builder(
                            padding: EdgeInsets.zero,
                            shrinkWrap: true,
                            itemCount: options.length,
                            itemBuilder: (context, i) {
                              final opt = options.elementAt(i);
                              return InkWell(
                                onTap: () => onSelected(opt),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  child: Text(opt.nmDokter, style: const TextStyle(fontSize: 13)),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
              const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        setState(() {
                          _tglDari = null;
                          _tglSampai = null;
                          _dpjpText = '';
                          _dpjpFieldCtrl?.clear();
                        });
                      },
                      child: const Text('Reset'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(_FilterResult(tglDari: _tglDari, tglSampai: _tglSampai, dpjp: _dpjpText)),
                      style: ElevatedButton.styleFrom(backgroundColor: kSidebarGreen, foregroundColor: Colors.white),
                      child: const Text('Terapkan'),
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

  Widget _dateField(String label, DateTime? value, VoidCallback onTap, {VoidCallback? onClear}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(4)),
        child: Row(
          children: [
            Icon(Icons.calendar_today_outlined, size: 14, color: const Color(0xFF6B7280)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                value == null ? label : DateFormat('d MMM yyyy', 'id_ID').format(value),
                style: TextStyle(fontSize: 12, color: value == null ? const Color(0xFF9CA3AF) : const Color(0xFF111827)),
              ),
            ),
            if (onClear != null)
              InkWell(onTap: onClear, child: const Icon(Icons.close, size: 14, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }
}

class _PatientTable extends StatelessWidget {
  final List<RanapPatient> list;
  final void Function(RanapPatient) onTapRow;
  final bool showTglPulang;
  const _PatientTable({required this.list, required this.onTapRow, required this.showTglPulang});

  static const _headersBase = ['No. RM', 'Nama Pasien', 'Kamar', 'Diagnosa', 'DPJP', 'Jenis Bayar', 'Tgl Masuk'];
  static const _flexBase = [1, 3, 2, 2, 2, 2, 2];
  // Jenis Bayar & Tgl Masuk dipersempit jadi lebar tetap (bukan flex lagi)
  // — cukup ±11-12 karakter, per arahan user.
  static const double narrowColWidth = 96;
  static const _narrowHeaders = {'Jenis Bayar', 'Tgl Masuk', 'Tgl Pulang'};
  // Kolom tanggal rata kanan — biar mepet ke garis tabel kanan, jarak
  // renggangnya sama spt No. RM yg mepet ke garis kiri (rata kiri).
  static const _rightAlignedHeaders = {'Tgl Masuk', 'Tgl Pulang'};

  @override
  Widget build(BuildContext context) {
    final headers = [..._headersBase, if (showTglPulang) 'Tgl Pulang'];
    final flex = [..._flexBase, if (showTglPulang) 2];
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: kBorder)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFFF9FAFB),
            child: Row(
              children: List.generate(headers.length, (i) {
                final label = Text(
                  headers[i],
                  textAlign: _rightAlignedHeaders.contains(headers[i]) ? TextAlign.right : TextAlign.left,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF6B7280)),
                );
                if (_narrowHeaders.contains(headers[i])) return SizedBox(width: narrowColWidth, child: label);
                return Expanded(flex: flex[i], child: label);
              }),
            ),
          ),
          Expanded(
            child: ListView.separated(
              // padding: zero WAJIB eksplisit — tanpa ini ListView (dianggap
              // scroll utama route ini krn tidak ada AppBar di atasnya)
              // otomatis nambah inset atas sebesar status bar, bikin jarak
              // ke baris pertama jauh lebih lebar drpd antar baris lainnya.
              padding: EdgeInsets.zero,
              itemCount: list.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: kBorder),
              itemBuilder: (context, i) => _PatientRow(patient: list[i], even: i % 2 == 0, onTap: () => onTapRow(list[i]), showTglPulang: showTglPulang),
            ),
          ),
        ],
      ),
    );
  }
}

class _PatientRow extends StatelessWidget {
  final RanapPatient patient;
  final bool even;
  final VoidCallback onTap;
  final bool showTglPulang;
  const _PatientRow({required this.patient, required this.even, required this.onTap, required this.showTglPulang});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: even ? Colors.white : const Color(0xFFFAFAFA),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(flex: 1, child: Text(patient.noRkmMedis, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)))),
            Expanded(
              flex: 3,
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
                    child: const Icon(Icons.person, size: 18, color: Color(0xFF2563EB)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(patient.nmPasien, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text(patient.umur, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(flex: 2, child: Text(patient.kamar, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Expanded(flex: 2, child: Text(patient.diagnosaAwal.isEmpty ? '-' : patient.diagnosaAwal, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Expanded(flex: 2, child: Text(patient.nmDokter, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)), maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: _PatientTable.narrowColWidth, child: Text(patient.pngJawab.isEmpty ? '-' : patient.pngJawab, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)), maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: _PatientTable.narrowColWidth, child: Text(patient.tglMasuk, textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)), maxLines: 1, overflow: TextOverflow.ellipsis)),
            if (showTglPulang) SizedBox(width: _PatientTable.narrowColWidth, child: Text(patient.tglKeluar.isEmpty ? '-' : patient.tglKeluar, textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
    );
  }
}
