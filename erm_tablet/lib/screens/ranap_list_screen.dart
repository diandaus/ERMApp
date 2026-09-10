import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/app_user.dart';
import '../models/dokter_option.dart';
import '../models/ranap_patient.dart';
import '../services/dokter_service.dart';
import '../services/ranap_service.dart';
import 'pasien_detail_screen.dart';

const kBorder = Color(0xFFE5E7EB);
const kHeaderGreen = Color(0xFF059669);

/// RanapListScreen — tab Ranap di MainShell. Daftar pasien penuh 1 layar
/// (portrait-first, sesuai arahan user) — klik pasien SELALU push ke layar
/// detail terpisah (Pemeriksaan/Jadwal Obat), TIDAK ditampilkan
/// side-by-side lagi (beda dari desain awal yg dua-panel di layar lebar).
class RanapListScreen extends StatefulWidget {
  final AppUser user;
  final VoidCallback onLogout;
  const RanapListScreen({super.key, required this.user, required this.onLogout});

  @override
  State<RanapListScreen> createState() => _RanapListScreenState();
}

class _RanapListScreenState extends State<RanapListScreen> {
  bool _loading = true;
  String? _error;
  List<RanapPatient> _list = [];
  String _status = 'belum-pulang';
  final _searchCtrl = TextEditingController();

  // Filter (Tgl Masuk Dari/Sampai + DPJP) — diterapkan client-side, sama
  // pola dgn RanapTableScreen (landscape), tapi disajikan lewat bottom
  // sheet di sini (bukan panel geser 40% — layar portrait terlalu sempit
  // utk itu).
  DateTime? _filterTglDari;
  DateTime? _filterTglSampai;
  String _filterDpjp = '';
  List<DokterOption> _dokterList = [];

  bool get _filterActive => _filterTglDari != null || _filterTglSampai != null || _filterDpjp.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _load();
    _loadDokterList();
    _searchCtrl.addListener(() => setState(() {}));
  }

  Future<void> _loadDokterList() async {
    try {
      final list = await DokterService.getList();
      if (mounted) setState(() => _dokterList = list);
    } catch (_) {/* diam, combobox DPJP kosong kalau gagal */}
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
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

  List<RanapPatient> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    return _list.where((p) {
      if (q.isNotEmpty && !(p.nmPasien.toLowerCase().contains(q) || p.noRkmMedis.toLowerCase().contains(q) || p.kamar.toLowerCase().contains(q))) return false;
      if (_filterTglDari != null || _filterTglSampai != null) {
        final tgl = DateTime.tryParse(p.tglMasuk);
        if (tgl == null) return false;
        if (_filterTglDari != null && tgl.isBefore(DateTime(_filterTglDari!.year, _filterTglDari!.month, _filterTglDari!.day))) return false;
        if (_filterTglSampai != null && tgl.isAfter(DateTime(_filterTglSampai!.year, _filterTglSampai!.month, _filterTglSampai!.day, 23, 59, 59))) return false;
      }
      if (_filterDpjp.trim().isNotEmpty && !p.nmDokter.toLowerCase().contains(_filterDpjp.trim().toLowerCase())) return false;
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: _buildListPane());
  }

  /// _openFilterSheet — bottom sheet (bukan panel geser 40% spt landscape,
  /// layar portrait terlalu sempit utk itu). Isi sama: rentang Tanggal
  /// Masuk + DPJP (combobox, langsung tampilkan semua dokter saat
  /// difokuskan, sama persis pola RanapTableScreen).
  Future<void> _openFilterSheet() async {
    final result = await showModalBottomSheet<_ListFilterResult>(
      context: context,
      isScrollControlled: true,
      // Tanpa constraints eksplisit, Material 3 otomatis membatasi &
      // menengahkan lebar bottom sheet di layar lebar (tablet) — dipaksa
      // selebar layar penuh di sini, per arahan user.
      constraints: const BoxConstraints(),
      builder: (_) => _ListFilterSheet(initialDari: _filterTglDari, initialSampai: _filterTglSampai, initialDpjp: _filterDpjp, dokterList: _dokterList),
    );
    if (result == null || !mounted) return;
    setState(() {
      _filterTglDari = result.tglDari;
      _filterTglSampai = result.tglSampai;
      _filterDpjp = result.dpjp;
    });
  }

  void _openDetailFullScreen(RanapPatient patient) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(
          toolbarHeight: 44,
          backgroundColor: kHeaderGreen,
          foregroundColor: Colors.white,
          elevation: 0,
          // Jadwal Obat sejajar tombol back, rata kanan — per arahan
          // user (sebelumnya di dalam header hijau PasienDetailScreen).
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: OutlinedButton.icon(
                onPressed: () => openJadwalObat(context, user: widget.user, patient: patient),
                icon: const Icon(Icons.medication_outlined, size: 16, color: Colors.white),
                label: const Text('Jadwal Obat', style: TextStyle(fontSize: 12, color: Colors.white)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  side: const BorderSide(color: Colors.white),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ),
        body: PasienDetailScreen(user: widget.user, patient: patient),
      ),
    ));
  }

  Widget _buildListPane() {
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // Header hijau (judul + refresh + kolom cari) — padanan gaya
          // umum app Android (mis. WhatsApp/Gmail). Nama user SENGAJA
          // tidak ditampilkan di sini lagi — nanti muncul di tab Home
          // setelah dikembangkan.
          Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            color: kHeaderGreen,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Rawat Inap', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh, size: 20, color: Colors.white),
                      tooltip: 'Muat ulang',
                      onPressed: _load,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchCtrl,
                        decoration: InputDecoration(
                          isDense: true,
                          filled: true,
                          fillColor: Colors.white,
                          hintText: 'Cari nama / no. RM / kamar...',
                          prefixIcon: const Icon(Icons.search, size: 18),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      child: InkWell(
                        onTap: _openFilterSheet,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          width: 42,
                          height: 42,
                          alignment: Alignment.center,
                          child: Icon(Icons.filter_alt_outlined, size: 20, color: _filterActive ? kHeaderGreen : const Color(0xFF6B7280)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kBorder))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
                  : _error != null
                      ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
                      : _filtered.isEmpty
                          ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Tidak ada pasien', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
                          : ListView.separated(
                              padding: const EdgeInsets.all(8),
                              itemCount: _filtered.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 6),
                              itemBuilder: (context, i) => _PatientTile(
                                patient: _filtered[i],
                                onTap: () => _openDetailFullScreen(_filtered[i]),
                              ),
                            ),
            ),
          ),
        ],
      ),
    );
  }

}

class _PatientTile extends StatelessWidget {
  final RanapPatient patient;
  final VoidCallback onTap;
  const _PatientTile({required this.patient, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: kBorder),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 52,
              height: 52,
              margin: const EdgeInsets.only(right: 10),
              decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
              child: const Icon(Icons.person, size: 28, color: Color(0xFF2563EB)),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Baris 1 — No.RM | Nama (Umur) di kiri + badge Lama
                  // dirawat di kanan (manfaatkan ruang kosong).
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${patient.noRkmMedis} | ${patient.nmPasien} (${patient.umur})',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFF3E8FF), borderRadius: BorderRadius.circular(999)),
                        child: Text(patient.lama.isEmpty ? '-' : patient.lama, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF6B21A8))),
                      ),
                    ],
                  ),
                  // Baris 2 — Masuk : tgl | jam di kiri + badge Jenis Bayar
                  // di kanan.
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text('Masuk : ${patient.tglMasuk} | ${patient.jamMasuk}', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFFE0F2FE), borderRadius: BorderRadius.circular(999)),
                          child: Text(patient.pngJawab.isEmpty ? '-' : patient.pngJawab, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF0369A1))),
                        ),
                      ],
                    ),
                  ),
                  // Baris 3 — Diagnosa Awal di kiri (flex+ellipsis) + Kamar ·
                  // Dokter di kanan.
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Diagnosa Awal : ${patient.diagnosaAwal}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Tanpa pembatas lebar — nama dokter selalu sebaris
                        // penuh (tidak wrap, tidak terpotong), memanfaatkan
                        // ruang kosong yg ditinggalkan Diagnosa Awal yg
                        // mengalah (Expanded, ellipsis) di sebelah kiri.
                        Text.rich(
                          TextSpan(children: [
                            TextSpan(text: '${patient.kamar} · ', style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
                            TextSpan(text: patient.nmDokter, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.black)),
                          ]),
                          softWrap: false,
                          overflow: TextOverflow.visible,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ListFilterResult {
  final DateTime? tglDari;
  final DateTime? tglSampai;
  final String dpjp;
  _ListFilterResult({this.tglDari, this.tglSampai, required this.dpjp});
}

/// _ListFilterSheet — isi bottom sheet Filter (Tanggal Masuk Dari/Sampai +
/// DPJP combobox), dipanggil dari [_RanapListScreenState._openFilterSheet].
/// Padanan persis _FilterPanel di RanapTableScreen (landscape), cuma beda
/// wadah (bottom sheet, bukan panel geser dari kanan).
class _ListFilterSheet extends StatefulWidget {
  final DateTime? initialDari;
  final DateTime? initialSampai;
  final String initialDpjp;
  final List<DokterOption> dokterList;
  const _ListFilterSheet({required this.initialDari, required this.initialSampai, required this.initialDpjp, required this.dokterList});

  @override
  State<_ListFilterSheet> createState() => _ListFilterSheetState();
}

class _ListFilterSheetState extends State<_ListFilterSheet> {
  DateTime? _tglDari;
  DateTime? _tglSampai;
  String _dpjpText = '';
  TextEditingController? _dpjpFieldCtrl;
  FocusNode? _dpjpFocusNode;
  bool _dpjpFocused = false;

  @override
  void initState() {
    super.initState();
    // Default hari ini kalau belum ada filter tersimpan — jangan kosong,
    // per arahan user.
    _tglDari = widget.initialDari ?? DateTime.now();
    _tglSampai = widget.initialSampai ?? DateTime.now();
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
    return Padding(
      // bottom: viewInsets.bottom -> naik otomatis begitu keyboard muncul
      // (isi ikut naik, tidak ketutup). SingleChildScrollView di bawah
      // jaga2 kalau ruang yg tersisa masih kurang (mis. keyboard tinggi +
      // combobox dokter kebuka bareng), biar tetap bisa discroll drpd
      // overflow.
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        // Combobox dokter difokuskan -> modal (bottom sheet ini, tertambat
        // di bawah layar) dipaksa naik sampai dekat atas layar, biar field
        // DPJP ikut naik & ruang di bawahnya cukup utk nampilin semua
        // dokter tanpa combobox kepotong, per arahan user.
        height: _dpjpFocused ? MediaQuery.of(context).size.height - MediaQuery.of(context).padding.top - 20 : null,
        child: SingleChildScrollView(
        child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(child: Text('Filter', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
              IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.of(context).pop(), padding: EdgeInsets.zero, constraints: const BoxConstraints(), visualDensity: VisualDensity.compact),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Tanggal Masuk', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: _dateField('Dari', _tglDari, _pickDari, onClear: _tglDari == null ? null : () => setState(() => _tglDari = null))),
              const SizedBox(width: 8),
              Expanded(child: _dateField('Sampai', _tglSampai, _pickSampai, onClear: _tglSampai == null ? null : () => setState(() => _tglSampai = null))),
            ],
          ),
          const SizedBox(height: 16),
          const Text('DPJP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 8),
          // Autocomplete — optionsBuilder balikin SEMUA dokter begitu query
          // kosong, jadi begitu kolom ini difokuskan langsung tampil
          // combobox berisi semua dokter, sama pola RanapTableScreen.
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
              if (_dpjpFocusNode != focusNode) {
                _dpjpFocusNode = focusNode;
                focusNode.addListener(() {
                  if (mounted) setState(() => _dpjpFocused = focusNode.hasFocus);
                });
              }
              return TextField(
                controller: controller,
                focusNode: focusNode,
                onChanged: (v) => _dpjpText = v,
                decoration: const InputDecoration(isDense: true, hintText: 'Nama dokter...', border: OutlineInputBorder()),
                style: const TextStyle(fontSize: 13),
              );
            },
            optionsViewBuilder: (context, onSelected, options) {
              // Modal sudah naik ke dekat atas layar saat fokus (lihat
              // AnimatedContainer di build()), jadi ruang di bawah field ikut
              // banyak -> maxHeight combobox dinaikkan drpd 240 tetap biar
              // makin banyak dokter kelihatan tanpa scroll.
              return Align(
                alignment: Alignment.topLeft,
                child: Material(
                  elevation: 4,
                  borderRadius: BorderRadius.circular(6),
                  child: SizedBox(
                    width: MediaQuery.of(context).size.width - 40,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.55),
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
          const SizedBox(height: 20),
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
                  onPressed: () => Navigator.of(context).pop(_ListFilterResult(tglDari: _tglDari, tglSampai: _tglSampai, dpjp: _dpjpText)),
                  style: ElevatedButton.styleFrom(backgroundColor: kHeaderGreen, foregroundColor: Colors.white),
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
            const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF6B7280)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                value == null ? label : DateFormat('d/M/yy', 'id_ID').format(value),
                style: TextStyle(fontSize: 12, color: value == null ? const Color(0xFF9CA3AF) : const Color(0xFF111827)),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (onClear != null) InkWell(onTap: onClear, child: const Icon(Icons.close, size: 14, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }
}
