import 'package:flutter/material.dart';

import '../../models/app_user.dart';
import '../../models/presensi_hari_ini.dart';
import '../../services/api_config.dart';
import '../../services/presensi_service.dart';
import '../../widgets/pengumuman_card.dart';
import '../../services/klinis_service.dart';
import '../atur_jadwal_view.dart';
import '../cuti_izin_view.dart';
import '../farmasi_view.dart';
import '../igd_view.dart';
import '../lapor_it_view.dart';
import '../lembur_view.dart';
import '../permintaan_queue_view.dart';
import '../poli_view.dart';
import '../ranap_view.dart';

const _kGreenDark = Color(0xFF059669);
const _kGreenLight = Color(0xFF34D399);
const _kBorder = Color(0xFFE5E7EB);

/// Padanan HomeTab di PresensiMobile.tsx (versi web) — banner sapaan,
/// kartu jam masuk/pulang + "Jadwal Saya Hari Ini", grid menu layanan,
/// dan kartu pengumuman aktif. Data `performa` dari /api/presensi/me
/// sengaja tidak dipakai — sudah dead code juga di versi web.
class HomeTab extends StatefulWidget {
  final AppUser user;
  const HomeTab({super.key, required this.user});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  bool _loading = true;
  PresensiMe? _me;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final me = await PresensiService.getMe(widget.user.nik);
      if (!mounted) return;
      setState(() {
        _me = me;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    final hariIni = _me?.hariIni;
    return RefreshIndicator(
      onRefresh: _load,
      color: _kGreenDark,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          // Stack, bukan Container.margin negatif (Flutter menolak inset
          // negatif di Container maupun Padding) — kartu jadi child kedua
          // yg tak diberi Positioned, jadi tinggi Stack otomatis mengikuti
          // kartu (lebih tinggi drpd banner), tak perlu hitung tinggi
          // manual. Push-down = tinggi status bar + 84 (tinggi konten
          // banner ~124 dikurangi overlap 40px, padanan margin:
          // '-40px 16px 0' di versi web) — banner-nya sendiri tembus
          // sampai balik status bar (lihat MainShell), jadi push-down
          // ini ikut nambah tinggi status bar spy overlap tetap 40px.
          Stack(
            clipBehavior: Clip.none,
            children: [
              _HeaderBanner(user: widget.user, photoUrl: _me?.photo),
              Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).padding.top + 84),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x1F0F172A),
                            blurRadius: 30,
                            offset: Offset(0, 10))
                      ],
                    ),
                    child: _ScheduleCard(hariIni: hariIni),
                  ),
                ],
              ),
            ],
          ),
          _LayananGrid(user: widget.user),
          const PengumumanCard(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _HeaderBanner extends StatelessWidget {
  final AppUser user;
  final String? photoUrl;
  const _HeaderBanner({required this.user, this.photoUrl});

  String get _initials {
    final parts = user.fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final statusBarHeight = MediaQuery.of(context).padding.top;
    final resolvedPhotoUrl = resolvePhotoUrl(photoUrl);
    return Container(
      padding: EdgeInsets.fromLTRB(16, statusBarHeight + 20, 16, 56),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
            colors: [_kGreenLight, _kGreenDark],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: Colors.white.withValues(alpha: 0.25),
            backgroundImage: resolvedPhotoUrl != null ? NetworkImage(resolvedPhotoUrl) : null,
            child: resolvedPhotoUrl != null
                ? null
                : Text(_initials,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 16)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Assalamualaikum Wr. Wb.',
                    style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.85))),
                Text(user.fullName,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
                const SizedBox(height: 2),
                Text(
                  user.role.isEmpty
                      ? ''
                      : user.role[0].toUpperCase() + user.role.substring(1),
                  style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.85)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  final PresensiHariIni? hariIni;
  const _ScheduleCard({required this.hariIni});

  @override
  Widget build(BuildContext context) {
    final late = hariIni != null &&
        hariIni!.keterlambatan.isNotEmpty &&
        hariIni!.keterlambatan != '-';
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                    border: Border(right: BorderSide(color: _kBorder))),
                child: _MasukPulangCol(
                  label: 'Masuk',
                  jam: hariIni?.jamDatang,
                  status: hariIni?.status,
                  highlightRed: late,
                ),
              ),
            ),
            Expanded(
              child: _MasukPulangCol(
                label: 'Pulang',
                jam: hariIni?.jamPulang,
                status: null,
                highlightRed: false,
              ),
            ),
          ],
        ),
        Container(
          margin: const EdgeInsets.only(top: 16),
          padding: const EdgeInsets.only(top: 16),
          decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: _kBorder))),
          child: Column(
            children: [
              const Text('Jadwal Saya Hari Ini',
                  style: TextStyle(
                      fontSize: 13,
                      color: _kGreenDark,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5)),
              const SizedBox(height: 4),
              if (hariIni?.jamMasukJadwal.isNotEmpty == true &&
                  hariIni?.jamPulangJadwal.isNotEmpty == true)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.login_rounded,
                        size: 20, color: Color(0xFF111827)),
                    const SizedBox(width: 8),
                    Text(hariIni!.jamMasukJadwal,
                        style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF111827))),
                    const Text('  —  ',
                        style: TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontWeight: FontWeight.w400)),
                    const Icon(Icons.login_rounded,
                        size: 20, color: Color(0xFF111827)),
                    const SizedBox(width: 8),
                    Text(hariIni!.jamPulangJadwal,
                        style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF111827))),
                  ],
                )
              else
                const Text('Tidak ada jadwal/libur',
                    style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
              if (late)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('Anda telat ${hariIni!.keterlambatan}',
                      style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFFDC2626),
                          fontWeight: FontWeight.w600)),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MasukPulangCol extends StatelessWidget {
  final String label;
  final String? jam;
  final String? status;
  final bool highlightRed;
  const _MasukPulangCol(
      {required this.label,
      required this.jam,
      required this.status,
      required this.highlightRed});

  @override
  Widget build(BuildContext context) {
    final jamText = (jam == null || jam!.isEmpty) ? '--:--' : jam!;
    final statusText =
        (jam == null || jam!.isEmpty) ? 'Belum absen' : (status ?? '-');
    return Column(
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF9CA3AF),
                fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(jamText,
            style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: Color(0xFF111827))),
        const SizedBox(height: 2),
        Text(statusText,
            style: TextStyle(
                fontSize: 11,
                color: highlightRed
                    ? const Color(0xFFDC2626)
                    : const Color(0xFF9CA3AF))),
      ],
    );
  }
}

class _LayananItem {
  final String label;
  final IconData icon;
  const _LayananItem(this.label, this.icon);
}

const _kLayananItemsInti = [
  _LayananItem('Lembur', Icons.more_time_outlined),
  _LayananItem('Cuti', Icons.beach_access_outlined),
  _LayananItem('Izin', Icons.description_outlined),
  _LayananItem('Tugas', Icons.task_alt_outlined),
  _LayananItem('Lapor IT', Icons.desktop_windows_outlined),
  // Menu default spt Cuti/Izin (tampil ke semua user, gak digating
  // allowed_modules) — yg batasi cakupan aksesnya adalah dropdown
  // Departemen di dalam AturJadwalView sendiri: non-admin otomatis
  // terkunci ke departemen dia sendiri, admin bebas pilih semua.
  _LayananItem('Atur Jadwal', Icons.event_available_outlined),
];

const _kLayananItemsKlinis = [
  _LayananItem('Poli', Icons.medical_information_outlined),
  _LayananItem('IGD', Icons.emergency_outlined),
  _LayananItem('Ranap', Icons.bed_outlined),
  _LayananItem('Farmasi', Icons.medication_outlined),
  _LayananItem('Lab', Icons.science_outlined),
  _LayananItem('Radiologi', Icons.medical_services_outlined),
  _LayananItem('Operasi', Icons.content_cut_outlined),
];

/// Padanan canAccessModule/canAccessMenu di PresensiMobile.tsx & App.tsx
/// (versi web) — Poli/IGD/Ranap/Farmasi/Lab/Radiologi/Operasi di grid menu
/// cuma tampil kalau modul terkait diizinkan buat akun yg login, lewat
/// allowed_modules (diatur admin) atau fallback per role kalau
/// allowed_modules kosong. Kunci modul HARUS sama persis dgn yg dipakai
/// shell desktop (App.tsx canAccessMenu): 'rawat-jalan', 'igd',
/// 'rawat-inap', 'farmasi', 'laboratorium' (bukan 'lab'), 'radiologi',
/// 'jadwal-operasi' (bukan 'operasi').
bool _canAccessModule(AppUser user, String moduleKey) {
  if (user.allowedModules.isNotEmpty) {
    return user.allowedModules
        .split(',')
        .where((s) => s.isNotEmpty)
        .contains(moduleKey);
  }
  switch (user.role) {
    case 'dokter':
      return moduleKey == 'rawat-jalan' || moduleKey == 'rawat-inap';
    case 'farmasi':
      return moduleKey == 'farmasi';
    case 'admin':
      return true;
    default:
      return false;
  }
}

/// Daftar menu lengkap sesuai hak akses `user` — dipakai bareng oleh grid
/// Home (yg cuma nampilin sebagian) dan SemuaMenuView (nampilin semua).
List<_LayananItem> _layananItemsUntuk(AppUser user) {
  return [
    ..._kLayananItemsInti,
    if (_canAccessModule(user, 'rawat-jalan')) _kLayananItemsKlinis[0], // Poli
    if (_canAccessModule(user, 'igd')) _kLayananItemsKlinis[1], // IGD
    if (_canAccessModule(user, 'rawat-inap')) _kLayananItemsKlinis[2], // Ranap
    if (_canAccessModule(user, 'farmasi')) _kLayananItemsKlinis[3], // Farmasi
    if (_canAccessModule(user, 'laboratorium')) _kLayananItemsKlinis[4], // Lab
    if (_canAccessModule(user, 'radiologi')) _kLayananItemsKlinis[5], // Radiologi
    if (_canAccessModule(user, 'jadwal-operasi')) _kLayananItemsKlinis[6], // Operasi
  ];
}

void _onLayananTap(BuildContext context, AppUser user, String label) {
  final nik = user.nik;
  switch (label) {
    case 'Lembur':
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => LemburView(nik: nik)));
      return;
    case 'Cuti':
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => CutiIzinView(nik: nik, mode: 'cuti')));
      return;
    case 'Izin':
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => CutiIzinView(nik: nik, mode: 'izin')));
      return;
    case 'Lapor IT':
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => LaporItView(nik: nik)));
      return;
    case 'Poli':
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => PoliView(user: user)));
      return;
    case 'IGD':
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => const IgdView()));
      return;
    case 'Ranap':
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => RanapView(user: user)));
      return;
    case 'Farmasi':
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => const FarmasiView()));
      return;
    case 'Lab':
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => PermintaanQueueView(
              title: 'Permintaan Lab',
              emptyText: 'Belum ada permintaan lab hari ini',
              fetcher: KlinisService.getLabList)));
      return;
    case 'Radiologi':
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => PermintaanQueueView(
              title: 'Permintaan Radiologi',
              emptyText: 'Belum ada permintaan radiologi hari ini',
              fetcher: KlinisService.getRadiologiList)));
      return;
    case 'Atur Jadwal':
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => AturJadwalView(user: user)));
      return;
    default:
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('$label — fitur ini akan segera hadir.'),
            backgroundColor: _kGreenDark),
      );
  }
}

Widget _layananItemTile(BuildContext context, AppUser user, _LayananItem item) {
  return SizedBox(
    width: 68,
    child: GestureDetector(
      onTap: () => _onLayananTap(context, user, item.label),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 44,
            height: 44,
            child: Icon(item.icon, color: _kGreenDark, size: 26),
          ),
          const SizedBox(height: 0),
          Text(item.label,
              style: const TextStyle(fontSize: 10, color: Color(0xFF374151)),
              textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}

// 3 baris x 4 kolom = 12 slot; kalau menu lebih dari itu, slot terakhir
// diganti tombol "•••" yg buka SemuaMenuView (bukan expand di tempat)
// spy card Home tetap ringkas.
const int _kLayananGridSlots = 12;

class _LayananGrid extends StatelessWidget {
  final AppUser user;
  const _LayananGrid({required this.user});

  @override
  Widget build(BuildContext context) {
    final items = _layananItemsUntuk(user);
    final hasMore = items.length > _kLayananGridSlots;
    final visibleItems =
        hasMore ? items.take(_kLayananGridSlots - 1).toList() : items;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(16)),
      // Wrap (bukan GridView.count) — GridView.count selalu meregangkan 4
      // kolom mengisi penuh lebar card, jadi mengubah spacing cuma
      // realokasi kecil antara lebar sel & jarak (efek keliatannya cuma
      // ~1/4 dari nilai spacing, nyaris tak kelihatan). Wrap dgn lebar sel
      // TETAP (bukan ikut melebar) bikin spacing benar-benar jadi jarak
      // visual antar ikon, bukan cuma dipakai buat itung ulang lebar sel.
      child: Wrap(
        alignment: WrapAlignment.start,
        spacing: 16,
        runSpacing: 6,
        children: [
          ...visibleItems.map((item) => _layananItemTile(context, user, item)),
          if (hasMore)
            SizedBox(
              width: 68,
              child: GestureDetector(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => SemuaMenuView(user: user))),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(
                      width: 44,
                      height: 44,
                      child: Icon(Icons.more_horiz, color: _kGreenDark, size: 26),
                    ),
                    const SizedBox(height: 0),
                    const Text('Lihat Semua',
                        style:
                            TextStyle(fontSize: 10, color: Color(0xFF374151)),
                        textAlign: TextAlign.center),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Layar "Semua Menu" — dibuka dari tombol "•••" di grid Home kalau menu
/// yg diizinkan buat user > 12 (tidak muat di grid ringkas Home).
class SemuaMenuView extends StatelessWidget {
  final AppUser user;
  const SemuaMenuView({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final items = _layananItemsUntuk(user);
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Semua Menu',
            style: TextStyle(
                color: Color(0xFF111827),
                fontWeight: FontWeight.w700,
                fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: _kBorder),
              borderRadius: BorderRadius.circular(16)),
          child: Wrap(
            alignment: WrapAlignment.start,
            spacing: 16,
            runSpacing: 16,
            children: items
                .map((item) => _layananItemTile(context, user, item))
                .toList(),
          ),
        ),
      ),
    );
  }
}
