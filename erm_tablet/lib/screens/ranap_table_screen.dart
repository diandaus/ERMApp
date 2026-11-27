import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../models/dokter_option.dart';
import '../models/ranap_patient.dart';
import '../services/dokter_service.dart';
import '../services/ranap_service.dart';
import 'pasien_detail_landscape_screen.dart';
import '../theme/app_theme.dart';
import '../widgets/modal_tengah.dart';
import '../widgets/rentang_tanggal.dart';

const kBorder = kLine;
const kSidebarGreen = kPrimary;

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
  const RanapTableScreen(
      {super.key,
      required this.user,
      required this.onLogout,
      this.searchQuery = ''});

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

  bool get _filterActive =>
      _filterTglDari != null ||
      _filterTglSampai != null ||
      _filterDpjp.trim().isNotEmpty;

  List<RanapPatient> get _filteredList {
    final q = widget.searchQuery.trim().toLowerCase();
    return _list.where((p) {
      if (_filterTglDari != null || _filterTglSampai != null) {
        final tgl = DateTime.tryParse(p.tglMasuk);
        if (tgl == null) return false;
        if (_filterTglDari != null &&
            tgl.isBefore(DateTime(_filterTglDari!.year, _filterTglDari!.month,
                _filterTglDari!.day))) return false;
        if (_filterTglSampai != null &&
            tgl.isAfter(DateTime(
                _filterTglSampai!.year,
                _filterTglSampai!.month,
                _filterTglSampai!.day,
                23,
                59,
                59))) return false;
      }
      if (_filterDpjp.trim().isNotEmpty &&
          !p.nmDokter.toLowerCase().contains(_filterDpjp.trim().toLowerCase()))
        return false;
      if (q.isNotEmpty) {
        final haystack =
            '${p.noRkmMedis} ${p.nmPasien} ${p.nmDokter} ${p.kamar} ${p.diagnosaAwal} ${p.pngJawab}'
                .toLowerCase();
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

  /// _openFilterPanel — modal di tengah (gaya modal Input Tindakan):
  /// header ✕ + "Filter", Reset & Terapkan di kanan atas. Isi: rentang
  /// Tanggal Masuk (Dari/Sampai) + DPJP.
  Future<void> _openFilterPanel() async {
    final result = await showModalTengah<_FilterResult>(
      context,
      label: 'Filter',
      widthFactor: 0.45,
      builder: (_) => _FilterPanel(
          initialDari: _filterTglDari,
          initialSampai: _filterTglSampai,
          initialDpjp: _filterDpjp,
          dokterList: _dokterList),
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
      builder: (_) =>
          PasienDetailLandscapeScreen(user: widget.user, patient: patient),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF4F5F5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Toolbar putih MENEMPEL di bawah navbar (gaya referensi): tinggi
          // 48 = sejajar baris "Menu" di sidebar, tombol datar dipisah garis
          // vertikal, tab aktif teks tosca + garis bawah tosca.
          Container(
            height: 48,
            decoration: const BoxDecoration(color: Colors.white),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _loading
                          ? 'Pasien Rawat Inap'
                          : 'Pasien Rawat Inap (${_filteredList.length})',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: kText),
                    ),
                  ),
                ),
                const Spacer(),
                _StatusDropdown(
                  value: _status,
                  onChanged: (v) {
                    if (v == _status) return;
                    setState(() => _status = v);
                    _load();
                  },
                ),
                _BarButton(
                  icon: Icons.filter_alt_outlined,
                  label: 'Filter',
                  active: _filterActive,
                  onTap: _openFilterPanel,
                ),
                _BarButton(
                    icon: Icons.refresh, tooltip: 'Muat ulang', onTap: _load),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: Text(_error!,
                              style: const TextStyle(
                                  fontSize: 12, color: Color(0xFFDC2626))))
                      : _filteredList.isEmpty
                          ? const Center(
                              child: Text('Tidak ada pasien',
                                  style: TextStyle(
                                      fontSize: 12, color: Color(0xFF9CA3AF))))
                          : _PatientTable(
                              list: _filteredList,
                              onTapRow: _openDetail,
                              showTglPulang: _status == 'sudah-pulang'),
            ),
          ),
        ],
      ),
    );
  }
}

const _kBarDivider = Border(left: BorderSide(color: kBorder));

/// Satu tombol dropdown status pulang (gaya "Jenis Order" di referensi):
/// teks tosca + panah ▼, pilihan Belum/Sudah Pulang muncul di menu.
class _StatusDropdown extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  const _StatusDropdown({required this.value, required this.onChanged});

  static const _opsi = {
    'belum-pulang': 'Belum Pulang',
    'sudah-pulang': 'Sudah Pulang'
  };

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'Status pasien',
      onSelected: onChanged,
      position: PopupMenuPosition.under,
      color: Colors.white,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(6),
          side: const BorderSide(color: kBorder)),
      itemBuilder: (_) => _opsi.entries
          .map((e) => PopupMenuItem<String>(
                value: e.key,
                child: Row(
                  children: [
                    SizedBox(
                        width: 22,
                        child: e.key == value
                            ? const Icon(Icons.check,
                                size: 18, color: kPrimaryDark)
                            : null),
                    const SizedBox(width: 6),
                    Text(e.value,
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: e.key == value
                                ? FontWeight.w600
                                : FontWeight.w400,
                            color: e.key == value ? kPrimaryDark : kText)),
                  ],
                ),
              ))
          .toList(),
      child: Container(
        constraints: const BoxConstraints(minWidth: 190),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        decoration: const BoxDecoration(border: _kBarDivider),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_opsi[value] ?? value,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: kPrimaryDark)),
            const SizedBox(width: 6),
            const Icon(Icons.arrow_drop_down, size: 26, color: kPrimaryDark),
          ],
        ),
      ),
    );
  }
}

/// Tombol datar di toolbar (Filter, Muat ulang) — dipisah garis vertikal.
class _BarButton extends StatelessWidget {
  final IconData icon;
  final String? label;
  final String? tooltip;
  final bool active;
  final VoidCallback onTap;
  const _BarButton(
      {required this.icon,
      this.label,
      this.tooltip,
      this.active = false,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = active ? kPrimaryDark : kText;
    final child = InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: label == null ? 16 : 20),
        decoration: const BoxDecoration(border: _kBarDivider),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            if (label != null) ...[
              const SizedBox(width: 8),
              Text(label!,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                      color: color)),
            ],
          ],
        ),
      ),
    );
    return tooltip == null ? child : Tooltip(message: tooltip!, child: child);
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
  const _FilterPanel(
      {required this.initialDari,
      required this.initialSampai,
      required this.initialDpjp,
      required this.dokterList});

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

  void _reset() {
    setState(() {
      _tglDari = null;
      _tglSampai = null;
      _dpjpText = '';
      _dpjpFieldCtrl?.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ModalTengahHeader(
          title: 'Filter',
          secondaryLabel: 'Reset',
          onSecondary: _reset,
          actionLabel: 'Terapkan',
          onAction: () => Navigator.of(context).pop(_FilterResult(
              tglDari: _tglDari, tglSampai: _tglSampai, dpjp: _dpjpText)),
        ),
        Expanded(
          child: LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const ModalLabel('Tanggal Masuk'),
                  RentangTanggal(
                    bolehSemua: true,
                    value: _tglDari == null && _tglSampai == null
                        ? null
                        : DateTimeRange(
                            start: _tglDari ?? _tglSampai!,
                            end: _tglSampai ?? _tglDari!),
                    onChanged: (r) => setState(() {
                      _tglDari = r?.start;
                      _tglSampai = r?.end;
                    }),
                  ),
                  const SizedBox(height: 24),
                  const ModalLabel('DPJP'),
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
                      return widget.dokterList
                          .where((d) => d.nmDokter.toLowerCase().contains(q));
                    },
                    onSelected: (d) => setState(() => _dpjpText = d.nmDokter),
                    fieldViewBuilder:
                        (context, controller, focusNode, onFieldSubmitted) {
                      _dpjpFieldCtrl = controller;
                      return TextField(
                        controller: controller,
                        focusNode: focusNode,
                        onChanged: (v) => _dpjpText = v,
                        decoration: InputDecoration(
                          isDense: true,
                          hintText: 'Nama dokter...',
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 12),
                          enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(6),
                              borderSide:
                                  const BorderSide(color: Color(0xFFCFD1D1))),
                          focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(6),
                              borderSide: const BorderSide(
                                  color: kPrimary, width: 1.5)),
                        ),
                        style: const TextStyle(fontSize: 15),
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
                            width: box.maxWidth - 48,
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
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 10),
                                      child: Text(opt.nmDokter,
                                          style: const TextStyle(fontSize: 15)),
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
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PatientTable extends StatelessWidget {
  final List<RanapPatient> list;
  final void Function(RanapPatient) onTapRow;
  final bool showTglPulang;
  const _PatientTable(
      {required this.list,
      required this.onTapRow,
      required this.showTglPulang});

  static const _headersBase = [
    'No. RM',
    'Nama Pasien',
    'Kamar',
    'Diagnosa',
    'DPJP',
    'Jenis Bayar',
    'Tgl Masuk'
  ];
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
      // Tanpa border & tanpa bayangan — batas cukup dari kontras putih vs latar abu.
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(6)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Header tabel putih, teks tebal gelap + garis bawah (gaya referensi).
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: kBorder))),
            child: Row(
              children: List.generate(headers.length, (i) {
                final label = Text(
                  headers[i],
                  textAlign: _rightAlignedHeaders.contains(headers[i])
                      ? TextAlign.right
                      : TextAlign.left,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600, color: kText),
                );
                if (_narrowHeaders.contains(headers[i]))
                  return SizedBox(width: narrowColWidth, child: label);
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
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: kBorder),
              itemBuilder: (context, i) => _PatientRow(
                  patient: list[i],
                  even: i % 2 == 0,
                  onTap: () => onTapRow(list[i]),
                  showTglPulang: showTglPulang),
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
  const _PatientRow(
      {required this.patient,
      required this.even,
      required this.onTap,
      required this.showTglPulang});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        // Tanpa zebra — semua baris putih, dipisah garis tipis (gaya referensi).
        color: Colors.white,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
                flex: 1,
                child: Text(patient.noRkmMedis,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF374151)))),
            Expanded(
              flex: 3,
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: const BoxDecoration(
                        color: kPrimarySoft, shape: BoxShape.circle),
                    child:
                        const Icon(Icons.person, size: 18, color: kPrimaryDark),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(patient.nmPasien,
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF111827)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                        Text(patient.umur,
                            style: const TextStyle(
                                fontSize: 11, color: Color(0xFF9CA3AF))),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
                flex: 2,
                child: Text(patient.kamar,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF374151)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis)),
            Expanded(
                flex: 2,
                child: Text(
                    patient.diagnosaAwal.isEmpty ? '-' : patient.diagnosaAwal,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF374151)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis)),
            Expanded(
                flex: 2,
                child: Text(patient.nmDokter,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF374151)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis)),
            SizedBox(
                width: _PatientTable.narrowColWidth,
                child: Text(patient.pngJawab.isEmpty ? '-' : patient.pngJawab,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF374151)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis)),
            SizedBox(
                width: _PatientTable.narrowColWidth,
                child: Text(patient.tglMasuk,
                    textAlign: TextAlign.right,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis)),
            if (showTglPulang)
              SizedBox(
                  width: _PatientTable.narrowColWidth,
                  child: Text(
                      patient.tglKeluar.isEmpty ? '-' : patient.tglKeluar,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF6B7280)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
    );
  }
}
