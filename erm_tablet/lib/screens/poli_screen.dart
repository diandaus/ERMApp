import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/app_user.dart';
import '../models/dokter_option.dart';
import '../models/poli_patient.dart';
import '../services/api_client.dart';
import '../services/dokter_service.dart';
import '../services/rawat_jalan_service.dart';
import 'pemeriksaan_ralan_screen.dart';

const _kBorder = Color(0xFFE5E7EB);
const _kGreen = Color(0xFF059669);

const _kTabPoliToday = 'poli-today';
const _kTabRujukan = 'rujukan-internal';

const _kStatusList = ['Sudah', 'Belum', 'Batal', 'Dirujuk', 'Dirawat'];

/// Padanan getStatusStyle di RawatJalan.tsx — warna & label sama persis.
({Color bg, Color fg, String dropdownLabel}) _statusStyle(String status) {
  switch (status) {
    case 'Sudah':
      return (bg: const Color(0xFFECFDF3), fg: const Color(0xFF166534), dropdownLabel: 'Sudah Periksa');
    case 'Belum':
      return (bg: const Color(0xFFFEF3C7), fg: const Color(0xFF92400E), dropdownLabel: 'Belum Periksa');
    case 'Batal':
      return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B), dropdownLabel: 'Batal Periksa');
    case 'Dirujuk':
      return (bg: const Color(0xFFDBEAFE), fg: const Color(0xFF1E40AF), dropdownLabel: 'Dirujuk');
    case 'Dirawat':
      return (bg: const Color(0xFFF3E8FF), fg: const Color(0xFF6B21A8), dropdownLabel: 'Dirawat');
    default:
      return (bg: const Color(0xFFF3F4F6), fg: const Color(0xFF374151), dropdownLabel: status);
  }
}

/// PoliScreen — Daftar Pasien Poliklinik, padanan RawatJalan.tsx (web):
/// tab Poli Hari Ini / Rujukan Poli Internal, filter (rentang tanggal,
/// poliklinik, dokter — dokter DIKUNCI utk role dokter), ubah status
/// periksa, panggil antrian, auto-refresh 30 detik. Endpoint SAMA PERSIS
/// dgn web, tidak ada endpoint baru.
///
/// Satu State dipakai dua tata letak ([landscape]): tabel (gaya
/// RanapTableScreen, kolom cari ikut navbar atas lewat [searchQuery]) &
/// kartu (gaya RanapListScreen, header hijau + kolom cari sendiri).
///
/// BELUM direplikasi dari web: dropdown BPJS (Pembuatan SEP/Riwayat
/// Kunjungan/Lihat SEP), dropdown Surat (di web pun masih placeholder),
/// dan suara panggilan (TTS). Ketuk nama pasien membuka
/// PemeriksaanRalanScreen (padanan onSelectPatient).
class PoliScreen extends StatefulWidget {
  final AppUser user;
  final bool landscape;
  final String searchQuery;
  // Menu/tab ini sedang tampil — shell pakai IndexedStack (semua halaman
  // tetap hidup), jadi auto-refresh cuma jalan saat benar2 kelihatan.
  final bool active;
  const PoliScreen({super.key, required this.user, this.landscape = false, this.searchQuery = '', this.active = true});

  @override
  State<PoliScreen> createState() => _PoliScreenState();
}

class _PoliScreenState extends State<PoliScreen> {
  static final _apiDate = DateFormat('yyyy-MM-dd');

  String _tab = _kTabPoliToday;
  bool _loading = true;
  String? _error;
  List<PoliPatient> _poliToday = [];
  List<PoliPatient> _rujukan = [];

  DateTime _tglDari = DateUtils.dateOnly(DateTime.now());
  DateTime _tglSampai = DateUtils.dateOnly(DateTime.now());
  String _filterPoli = '';
  String _filterDokter = '';
  List<PoliOption> _poliOptions = [];
  List<DokterOption> _dokterOptions = [];

  final _searchCtrl = TextEditingController();
  Timer? _timer;

  bool get _filterActive {
    final today = DateUtils.dateOnly(DateTime.now());
    return _tglDari != today || _tglSampai != today || _filterPoli.isNotEmpty || _filterDokter.isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() => setState(() {}));
    _load();
    _loadOptions();
    // Auto-refresh tiap 30 detik (sama dgn web) — supaya pasien baru yg
    // mendaftar langsung kelihatan tanpa muat ulang manual.
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (widget.active) _load(silent: true);
    });
  }

  @override
  void didUpdateWidget(PoliScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) _load(silent: true);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final poli = await RawatJalanService.getPoliList();
      if (mounted) setState(() => _poliOptions = poli);
    } catch (_) {/* diam, pilihan poliklinik kosong kalau gagal */}
    try {
      final dokter = await DokterService.getList();
      if (mounted) setState(() => _dokterOptions = dokter);
    } catch (_) {/* diam, pilihan dokter kosong kalau gagal */}
  }

  /// [silent] — dipakai auto-refresh: tanpa spinner, dan kalau gagal
  /// daftar yg sudah tampil dibiarkan (tidak diganti pesan error).
  Future<void> _load({bool silent = false}) async {
    final tab = _tab;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final dari = _apiDate.format(_tglDari);
      final sampai = _apiDate.format(_tglSampai);
      final list = tab == _kTabPoliToday
          ? await RawatJalanService.getPoliToday(widget.user, tglDari: dari, tglSampai: sampai)
          : await RawatJalanService.getRujukanInternal(widget.user, tglDari: dari, tglSampai: sampai);
      if (!mounted) return;
      setState(() {
        if (tab == _kTabPoliToday) {
          _poliToday = list;
        } else {
          _rujukan = list;
        }
        if (tab == _tab) {
          _loading = false;
          _error = null;
        }
      });
    } catch (e) {
      if (!mounted || silent || tab != _tab) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Gagal mengambil data pasien poliklinik';
        _loading = false;
      });
    }
  }

  /// Padanan filteredPoliToday/filteredRujukanInternal di RawatJalan.tsx.
  List<PoliPatient> _applyFilter(List<PoliPatient> source) {
    final q = (widget.landscape ? widget.searchQuery : _searchCtrl.text).trim().toLowerCase();
    final user = widget.user;
    final filtered = source.where((p) {
      if (q.isNotEmpty && !'${p.noRkmMedis} ${p.nmPasien} ${p.nmDokter} ${p.nmPoli}'.toLowerCase().contains(q)) return false;
      if (_filterPoli.isNotEmpty && p.kdPoli != _filterPoli) return false;
      if (user.isDokter) {
        // Lapisan aman kedua (server sudah memfilter lewat kd_dokter) —
        // akun dokter yg belum di-link SENGAJA dikosongkan, bukan fallback
        // ke semua pasien.
        if (user.kdDokter.isEmpty || p.kdDokter != user.kdDokter) return false;
      } else if (_filterDokter.isNotEmpty && p.kdDokter != _filterDokter) {
        return false;
      }
      return true;
    }).toList();

    // "Sudah" di bawah; tiap kelompok urut no_rawat naik (padanan no
    // antrian 001,002,... krn no_rawat kronologis+sekuensial).
    filtered.sort((a, b) {
      final aSudah = a.stts == 'Sudah';
      final bSudah = b.stts == 'Sudah';
      if (aSudah != bSudah) return aSudah ? 1 : -1;
      return a.noRawat.compareTo(b.noRawat);
    });
    return filtered;
  }

  void _setTab(String tab) {
    if (tab == _tab) return;
    setState(() => _tab = tab);
    _load();
  }

  Future<void> _openFilter() async {
    final panel = _FilterPanel(
      user: widget.user,
      initial: _PoliFilter(tglDari: _tglDari, tglSampai: _tglSampai, kdPoli: _filterPoli, kdDokter: _filterDokter),
      poliOptions: _poliOptions,
      dokterOptions: _dokterOptions,
      sheet: !widget.landscape,
    );
    final _PoliFilter? result;
    if (widget.landscape) {
      // Panel geser dari kanan — sama pola dgn filter RanapTableScreen.
      result = await showGeneralDialog<_PoliFilter>(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'Filter',
        barrierColor: Colors.black38,
        transitionDuration: const Duration(milliseconds: 250),
        pageBuilder: (context, _, __) => Align(
          alignment: Alignment.centerRight,
          child: SizedBox(width: 300, height: double.infinity, child: panel),
        ),
        transitionBuilder: (context, anim, __, child) => SlideTransition(
          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
          child: child,
        ),
      );
    } else {
      result = await showModalBottomSheet<_PoliFilter>(
        context: context,
        isScrollControlled: true,
        constraints: const BoxConstraints(),
        builder: (context) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom), child: panel),
      );
    }
    if (result == null || !mounted) return;
    final f = result;
    final dateChanged = f.tglDari != _tglDari || f.tglSampai != _tglSampai;
    setState(() {
      _tglDari = f.tglDari;
      _tglSampai = f.tglSampai;
      _filterPoli = f.kdPoli;
      _filterDokter = f.kdDokter;
    });
    // Poliklinik/dokter disaring di klien; cuma rentang tanggal yg butuh
    // ambil ulang dari server.
    if (dateChanged) _load();
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? const Color(0xFFDC2626) : null));
  }

  Future<void> _changeStatus(PoliPatient p, String status) async {
    if (p.stts == status) return;
    try {
      await RawatJalanService.updateStatus(p.noRawat, status);
      if (!mounted) return;
      setState(() => p.stts = status);
      _toast('Status ${p.nmPasien} diubah menjadi: ${_statusStyle(status).dropdownLabel}');
    } catch (e) {
      if (!mounted) return;
      _toast('Gagal mengubah status: ${e is ApiException ? e.message : 'Terjadi kesalahan'}', error: true);
    }
  }

  /// Buka form pemeriksaan fullscreen; sepulangnya daftar dimuat ulang
  /// diam2 spy status (jadi "Sudah" setelah SOAP tersimpan) & urutannya
  /// ikut segar.
  Future<void> _openPemeriksaan(PoliPatient p) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => PemeriksaanRalanScreen(user: widget.user, patient: p)));
    if (mounted) _load(silent: true);
  }

  /// Web memanggil langsung sekali klik; di layar sentuh ditambah
  /// konfirmasi dulu krn salah sentuh langsung muncul di display antrian.
  Future<void> _callPatient(PoliPatient p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Panggil pasien?'),
        content: Text('${p.nmPasien}\nNo. Reg ${p.noReg} — ${p.nmPoli}\n\nPasien akan muncul di display antrian.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Panggil')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      final antrian = await RawatJalanService.callPatient(widget.user, p);
      if (!mounted) return;
      _toast('Pasien dipanggil — No. Antrian ${antrian['no_antrian'] ?? '-'} (${antrian['nm_poli'] ?? p.nmPoli})');
    } catch (e) {
      if (!mounted) return;
      _toast('Gagal memanggil pasien: ${e is ApiException ? e.message : 'Terjadi kesalahan'}', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final poliToday = _applyFilter(_poliToday);
    final rujukan = _applyFilter(_rujukan);
    final list = _tab == _kTabPoliToday ? poliToday : rujukan;
    final tabs = SegmentedButton<String>(
      segments: [
        ButtonSegment(value: _kTabPoliToday, label: Text('Poli Hari Ini (${poliToday.length})', style: const TextStyle(fontSize: 12))),
        ButtonSegment(value: _kTabRujukan, label: Text('Rujukan Poli Internal (${rujukan.length})', style: const TextStyle(fontSize: 12))),
      ],
      selected: {_tab},
      showSelectedIcon: false,
      style: SegmentedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
      onSelectionChanged: (s) => _setTab(s.first),
    );
    return widget.landscape ? _buildLandscape(tabs, list) : _buildPortrait(tabs, list);
  }

  Widget _buildBody(List<PoliPatient> list, Widget Function() builder) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))));
    if (list.isEmpty) {
      return Center(
        child: Text(
          _tab == _kTabPoliToday ? 'Tidak ada data pasien poli hari ini' : 'Tidak ada data rujukan internal hari ini',
          style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
        ),
      );
    }
    return builder();
  }

  Widget _buildLandscape(Widget tabs, List<PoliPatient> list) {
    final showNoReg = _tab == _kTabPoliToday;
    return Container(
      color: const Color(0xFFF9FAFB),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: Row(
              children: [
                tabs,
                const Spacer(),
                OutlinedButton.icon(
                  onPressed: _openFilter,
                  icon: Icon(Icons.filter_alt_outlined, size: 16, color: _filterActive ? _kGreen : const Color(0xFF6B7280)),
                  label: Text('Filter', style: TextStyle(fontSize: 12, color: _filterActive ? _kGreen : const Color(0xFF374151))),
                  style: OutlinedButton.styleFrom(side: BorderSide(color: _filterActive ? _kGreen : _kBorder), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
                ),
                const SizedBox(width: 8),
                IconButton(icon: const Icon(Icons.refresh), tooltip: 'Muat ulang', onPressed: _load),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: _buildBody(
                list,
                () => Container(
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: _kBorder)),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      _TableHeader(showNoReg: showNoReg),
                      Expanded(
                        child: ListView.separated(
                          padding: EdgeInsets.zero,
                          itemCount: list.length,
                          separatorBuilder: (_, __) => const Divider(height: 1, color: _kBorder),
                          itemBuilder: (context, i) => _TableRow(
                            patient: list[i],
                            even: i % 2 == 0,
                            showNoReg: showNoReg,
                            onOpen: () => _openPemeriksaan(list[i]),
                            onCall: () => _callPatient(list[i]),
                            onStatus: (s) => _changeStatus(list[i], s),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPortrait(Widget tabs, List<PoliPatient> list) {
    final showNoReg = _tab == _kTabPoliToday;
    return Scaffold(
      body: Container(
        color: Colors.white,
        child: Column(
          children: [
            // Header hijau (judul + refresh + kolom cari + filter) — sama
            // gaya dgn RanapListScreen.
            Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
              color: _kGreen,
              child: SafeArea(
                bottom: false,
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Expanded(child: Text('Poliklinik', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white))),
                        IconButton(icon: const Icon(Icons.refresh, size: 20, color: Colors.white), tooltip: 'Muat ulang', onPressed: _load),
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
                              hintText: 'Cari no. RM / nama / dokter...',
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
                            onTap: _openFilter,
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              width: 42,
                              height: 42,
                              alignment: Alignment.center,
                              child: Icon(Icons.filter_alt_outlined, size: 20, color: _filterActive ? _kGreen : const Color(0xFF6B7280)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _kBorder))),
              child: Align(alignment: Alignment.centerLeft, child: tabs),
            ),
            Expanded(
              child: _buildBody(
                list,
                () => RefreshIndicator(
                  onRefresh: () => _load(silent: true),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(8),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, i) => _PatientTile(
                      patient: list[i],
                      showNoReg: showNoReg,
                      onOpen: () => _openPemeriksaan(list[i]),
                      onCall: () => _callPatient(list[i]),
                      onStatus: (s) => _changeStatus(list[i], s),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Warna baris — padanan web: Batal merah muda, Sudah hijau muda, sisanya
/// selang-seling.
Color _rowColor(PoliPatient p, bool even) {
  if (p.stts == 'Batal') return const Color(0xFFFEE2E2);
  if (p.stts == 'Sudah') return const Color(0xFFECFDF3);
  return even ? Colors.white : const Color(0xFFFAFAFA);
}

const double _wNoReg = 64;
const double _wWaktu = 84;
const double _wBayar = 96;
const double _wNoRawat = 128;
const double _wStatus = 100;

class _TableHeader extends StatelessWidget {
  final bool showNoReg;
  const _TableHeader({required this.showNoReg});

  @override
  Widget build(BuildContext context) {
    Widget label(String text) => Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF6B7280)));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: const Color(0xFFF9FAFB),
      child: Row(
        children: [
          Expanded(flex: 2, child: label('No. RM')),
          Expanded(flex: 5, child: label('Nama Pasien')),
          if (showNoReg) SizedBox(width: _wNoReg, child: label('No. Reg')),
          Expanded(flex: 5, child: label('Dokter')),
          Expanded(flex: 4, child: label(showNoReg ? 'Poli' : 'Poli Tujuan')),
          SizedBox(width: _wWaktu, child: label('Tgl Reg')),
          SizedBox(width: _wBayar, child: label('Cara Bayar')),
          SizedBox(width: _wNoRawat, child: label('No. Rawat')),
          SizedBox(width: _wStatus, child: label('Status')),
        ],
      ),
    );
  }
}

class _TableRow extends StatelessWidget {
  final PoliPatient patient;
  final bool even;
  final bool showNoReg;
  final VoidCallback onOpen;
  final VoidCallback onCall;
  final ValueChanged<String> onStatus;
  const _TableRow({required this.patient, required this.even, required this.showNoReg, required this.onOpen, required this.onCall, required this.onStatus});

  @override
  Widget build(BuildContext context) {
    const cell = TextStyle(fontSize: 12, color: Color(0xFF374151));
    final p = patient;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: _rowColor(p, even),
      child: Row(
        children: [
          Expanded(flex: 2, child: Text(p.noRkmMedis, style: cell)),
          Expanded(
            flex: 5,
            // Ketuk kolom nama -> buka form pemeriksaan fullscreen.
            child: InkWell(
              onTap: onOpen,
              child: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(p.nmPasien, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(p.umur, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                  ],
                ),
              ),
            ),
          ),
          if (showNoReg) SizedBox(width: _wNoReg, child: Align(alignment: Alignment.centerLeft, child: _NoRegButton(noReg: p.noReg, onPressed: onCall))),
          Expanded(flex: 5, child: Padding(padding: const EdgeInsets.only(right: 8), child: Text(p.nmDokter, style: cell, maxLines: 1, overflow: TextOverflow.ellipsis))),
          Expanded(flex: 4, child: Padding(padding: const EdgeInsets.only(right: 8), child: Text(p.nmPoli, style: cell, maxLines: 1, overflow: TextOverflow.ellipsis))),
          SizedBox(
            width: _wWaktu,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(p.tglRegistrasi, style: cell),
                Text(p.jamReg, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
              ],
            ),
          ),
          SizedBox(width: _wBayar, child: Text(p.pngJawab.isEmpty ? '-' : p.pngJawab, style: cell, maxLines: 1, overflow: TextOverflow.ellipsis)),
          SizedBox(width: _wNoRawat, child: Text(p.noRawat, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)), maxLines: 1, overflow: TextOverflow.ellipsis)),
          SizedBox(width: _wStatus, child: Align(alignment: Alignment.centerLeft, child: _StatusPill(status: p.stts, onSelected: onStatus))),
        ],
      ),
    );
  }
}

class _PatientTile extends StatelessWidget {
  final PoliPatient patient;
  final bool showNoReg;
  final VoidCallback onOpen;
  final VoidCallback onCall;
  final ValueChanged<String> onStatus;
  const _PatientTile({required this.patient, required this.showNoReg, required this.onOpen, required this.onCall, required this.onStatus});

  @override
  Widget build(BuildContext context) {
    final p = patient;
    const sub = TextStyle(fontSize: 11, color: Color(0xFF6B7280));
    // Ketuk kartu -> buka form pemeriksaan (pil status & tombol No. Reg
    // menangkap ketukannya sendiri).
    return GestureDetector(
      onTap: onOpen,
      child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _rowColor(p, true), border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${p.noRkmMedis} | ${p.nmPasien} (${p.umur})',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              _StatusPill(status: p.stts, onSelected: onStatus),
            ],
          ),
          const SizedBox(height: 4),
          Text('${p.nmDokter} · ${p.nmPoli}', style: sub, maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(child: Text('${p.tglRegistrasi} | ${p.jamReg} · ${p.noRawat}', style: sub, maxLines: 1, overflow: TextOverflow.ellipsis)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(999)),
                child: Text(p.pngJawab.isEmpty ? '-' : p.pngJawab, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF1E40AF))),
              ),
              if (showNoReg) ...[
                const SizedBox(width: 8),
                _NoRegButton(noReg: p.noReg, onPressed: onCall),
              ],
            ],
          ),
        ],
      ),
      ),
    );
  }
}

/// Tombol No. Reg — ketuk utk memanggil pasien ke display antrian
/// (padanan tombol no_reg di tabel web).
class _NoRegButton extends StatelessWidget {
  final String noReg;
  final VoidCallback onPressed;
  const _NoRegButton({required this.noReg, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        side: const BorderSide(color: Color(0xFF2563EB)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.campaign_outlined, size: 13, color: Color(0xFF2563EB)),
          const SizedBox(width: 3),
          Text(noReg, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF2563EB))),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  final ValueChanged<String> onSelected;
  const _StatusPill({required this.status, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    final style = _statusStyle(status);
    return PopupMenuButton<String>(
      tooltip: 'Ubah status',
      onSelected: onSelected,
      itemBuilder: (_) => _kStatusList
          .map((s) => PopupMenuItem<String>(
                value: s,
                height: 40,
                child: Text(
                  _statusStyle(s).dropdownLabel,
                  style: TextStyle(fontSize: 13, fontWeight: s == status ? FontWeight.w700 : FontWeight.w400, color: s == status ? const Color(0xFF2563EB) : const Color(0xFF374151)),
                ),
              ))
          .toList(),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 4, 4, 4),
        decoration: BoxDecoration(color: style.bg, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(status.isEmpty ? '-' : status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: style.fg)),
            Icon(Icons.arrow_drop_down, size: 16, color: style.fg),
          ],
        ),
      ),
    );
  }
}

class _PoliFilter {
  final DateTime tglDari;
  final DateTime tglSampai;
  final String kdPoli;
  final String kdDokter;
  _PoliFilter({required this.tglDari, required this.tglSampai, required this.kdPoli, required this.kdDokter});
}

/// _FilterPanel — isi filter (Tanggal Dari/Sampai + Poliklinik + Dokter),
/// dipakai dua wadah: panel geser kanan (landscape) & bottom sheet
/// (portrait, [sheet] true). Utk role dokter, pilihan Dokter diganti
/// lencana terkunci (padanan isDokterLocked di RawatJalan.tsx).
class _FilterPanel extends StatefulWidget {
  final AppUser user;
  final _PoliFilter initial;
  final List<PoliOption> poliOptions;
  final List<DokterOption> dokterOptions;
  final bool sheet;
  const _FilterPanel({required this.user, required this.initial, required this.poliOptions, required this.dokterOptions, required this.sheet});

  @override
  State<_FilterPanel> createState() => _FilterPanelState();
}

class _FilterPanelState extends State<_FilterPanel> {
  late DateTime _tglDari = widget.initial.tglDari;
  late DateTime _tglSampai = widget.initial.tglSampai;
  late String _kdPoli = widget.initial.kdPoli;
  late String _kdDokter = widget.initial.kdDokter;

  Future<void> _pick(bool dari) async {
    final picked = await showDatePicker(context: context, initialDate: dari ? _tglDari : _tglSampai, firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (picked == null) return;
    setState(() {
      if (dari) {
        _tglDari = picked;
        if (_tglSampai.isBefore(picked)) _tglSampai = picked;
      } else {
        _tglSampai = picked;
        if (_tglDari.isAfter(picked)) _tglDari = picked;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    const labelStyle = TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151));
    return Material(
      color: Colors.white,
      elevation: 8,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: widget.sheet ? MainAxisSize.min : MainAxisSize.max,
            children: [
              Row(
                children: [
                  const Expanded(child: Text('Filter', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)))),
                  IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.of(context).pop(), padding: EdgeInsets.zero, constraints: const BoxConstraints(), visualDensity: VisualDensity.compact),
                ],
              ),
              const SizedBox(height: 20),
              const Text('Tanggal Registrasi', style: labelStyle),
              const SizedBox(height: 8),
              _dateField('Dari', _tglDari, () => _pick(true)),
              const SizedBox(height: 8),
              _dateField('Sampai', _tglSampai, () => _pick(false)),
              const SizedBox(height: 20),
              const Text('Poliklinik', style: labelStyle),
              const SizedBox(height: 8),
              _dropdown(
                value: _kdPoli,
                allLabel: 'Semua Poliklinik',
                options: {for (final p in widget.poliOptions) p.kdPoli: p.nmPoli},
                onChanged: (v) => setState(() => _kdPoli = v),
              ),
              const SizedBox(height: 20),
              const Text('Dokter', style: labelStyle),
              const SizedBox(height: 8),
              if (widget.user.isDokter)
                _lockedDokter()
              else
                _dropdown(
                  value: _kdDokter,
                  allLabel: 'Semua Dokter',
                  options: {for (final d in widget.dokterOptions) d.kdDokter: d.nmDokter},
                  onChanged: (v) => setState(() => _kdDokter = v),
                ),
              if (widget.sheet) const SizedBox(height: 24) else const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        final today = DateUtils.dateOnly(DateTime.now());
                        setState(() {
                          _tglDari = today;
                          _tglSampai = today;
                          _kdPoli = '';
                          _kdDokter = '';
                        });
                      },
                      child: const Text('Reset'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(_PoliFilter(tglDari: _tglDari, tglSampai: _tglSampai, kdPoli: _kdPoli, kdDokter: _kdDokter)),
                      style: ElevatedButton.styleFrom(backgroundColor: _kGreen, foregroundColor: Colors.white),
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

  Widget _lockedDokter() {
    final kd = widget.user.kdDokter;
    final linked = kd.isNotEmpty;
    final nama = widget.dokterOptions.where((d) => d.kdDokter == kd).map((d) => d.nmDokter).firstOrNull ?? widget.user.fullName;
    final color = linked ? const Color(0xFF111827) : const Color(0xFFDC2626);
    return Tooltip(
      message: linked ? 'Daftar Pasien Poli dikunci ke akun dokter yang login' : 'Akun ini belum di-link ke kode dokter manapun — hubungi admin (Pengaturan > User)',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: linked ? const Color(0xFFF9FAFB) : const Color(0xFFFEF2F2),
          border: Border.all(color: linked ? _kBorder : const Color(0xFFFECACA)),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          children: [
            Icon(Icons.lock_outline, size: 14, color: color),
            const SizedBox(width: 8),
            Expanded(child: Text(linked ? nama : 'Belum di-link ke dokter', style: TextStyle(fontSize: 12, color: color), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
    );
  }

  /// [options] kode -> nama; '' = pilihan "Semua ...".
  Widget _dropdown({required String value, required String allLabel, required Map<String, String> options, required ValueChanged<String> onChanged}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(4)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          // Kode yg tidak ada di daftar (mis. daftar gagal dimuat) jatuh
          // ke "Semua" spy DropdownButton tidak assert.
          value: options.containsKey(value) ? value : '',
          isExpanded: true,
          isDense: true,
          padding: const EdgeInsets.symmetric(vertical: 10),
          style: const TextStyle(fontSize: 12, color: Color(0xFF111827)),
          items: [
            DropdownMenuItem(value: '', child: Text(allLabel, overflow: TextOverflow.ellipsis)),
            for (final e in options.entries)
              if (e.key.isNotEmpty) DropdownMenuItem(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (v) => onChanged(v ?? ''),
        ),
      ),
    );
  }

  Widget _dateField(String label, DateTime value, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(4)),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF6B7280)),
            const SizedBox(width: 8),
            SizedBox(width: 52, child: Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
            Expanded(child: Text(DateFormat('d MMM yyyy', 'id_ID').format(value), style: const TextStyle(fontSize: 12, color: Color(0xFF111827)))),
          ],
        ),
      ),
    );
  }
}
