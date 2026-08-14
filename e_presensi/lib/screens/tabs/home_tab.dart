import 'package:flutter/material.dart';

import '../../models/app_user.dart';
import '../../models/presensi_hari_ini.dart';
import '../../services/presensi_service.dart';
import '../../widgets/pengumuman_card.dart';
import '../cuti_izin_view.dart';
import '../lapor_it_view.dart';
import '../lembur_view.dart';

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
              _HeaderBanner(user: widget.user),
              Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).padding.top + 84),
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [BoxShadow(color: Color(0x1F0F172A), blurRadius: 30, offset: Offset(0, 10))],
                    ),
                    child: _ScheduleCard(hariIni: hariIni),
                  ),
                ],
              ),
            ],
          ),
          _LayananGrid(nik: widget.user.nik),
          const PengumumanCard(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _HeaderBanner extends StatelessWidget {
  final AppUser user;
  const _HeaderBanner({required this.user});

  String get _initials {
    final parts = user.fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final statusBarHeight = MediaQuery.of(context).padding.top;
    return Container(
      padding: EdgeInsets.fromLTRB(16, statusBarHeight + 20, 16, 56),
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [_kGreenLight, _kGreenDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: Colors.white.withValues(alpha: 0.25),
            child: Text(_initials, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Assalamualaikum Wr. Wb.', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.85))),
                Text(user.fullName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                const SizedBox(height: 2),
                Text(
                  user.role.isEmpty ? '' : user.role[0].toUpperCase() + user.role.substring(1),
                  style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.85)),
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
    final late = hariIni != null && hariIni!.keterlambatan.isNotEmpty && hariIni!.keterlambatan != '-';
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Container(
                decoration: const BoxDecoration(border: Border(right: BorderSide(color: _kBorder))),
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
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: _kBorder))),
          child: Column(
            children: [
              const Text('Jadwal Saya Hari Ini', style: TextStyle(fontSize: 13, color: _kGreenDark, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
              const SizedBox(height: 4),
              if (hariIni?.jamMasukJadwal.isNotEmpty == true && hariIni?.jamPulangJadwal.isNotEmpty == true)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.login_rounded, size: 20, color: Color(0xFF111827)),
                    const SizedBox(width: 8),
                    Text(hariIni!.jamMasukJadwal, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                    const Text('  —  ', style: TextStyle(color: Color(0xFF9CA3AF), fontWeight: FontWeight.w400)),
                    const Icon(Icons.login_rounded, size: 20, color: Color(0xFF111827)),
                    const SizedBox(width: 8),
                    Text(hariIni!.jamPulangJadwal, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                  ],
                )
              else
                const Text('Belum ada jadwal shift', style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
              if (late)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('Anda telat ${hariIni!.keterlambatan}', style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.w600)),
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
  const _MasukPulangCol({required this.label, required this.jam, required this.status, required this.highlightRed});

  @override
  Widget build(BuildContext context) {
    final jamText = (jam == null || jam!.isEmpty) ? '--:--' : jam!;
    final statusText = (jam == null || jam!.isEmpty) ? 'Belum absen' : (status ?? '-');
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF), fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(jamText, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
        const SizedBox(height: 2),
        Text(statusText, style: TextStyle(fontSize: 11, color: highlightRed ? const Color(0xFFDC2626) : const Color(0xFF9CA3AF))),
      ],
    );
  }
}

class _LayananItem {
  final String label;
  final IconData icon;
  const _LayananItem(this.label, this.icon);
}

const _kLayananItems = [
  _LayananItem('Lembur', Icons.more_time_outlined),
  _LayananItem('Cuti', Icons.beach_access_outlined),
  _LayananItem('Izin', Icons.description_outlined),
  _LayananItem('Tugas', Icons.task_alt_outlined),
  _LayananItem('Lapor IT', Icons.desktop_windows_outlined),
];

class _LayananGrid extends StatelessWidget {
  final String nik;
  const _LayananGrid({required this.nik});

  void _onTap(BuildContext context, String label) {
    switch (label) {
      case 'Lembur':
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => LemburView(nik: nik)));
        return;
      case 'Cuti':
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => CutiIzinView(nik: nik, mode: 'cuti')));
        return;
      case 'Izin':
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => CutiIzinView(nik: nik, mode: 'izin')));
        return;
      case 'Lapor IT':
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => LaporItView(nik: nik)));
        return;
      default:
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$label — fitur ini akan segera hadir.'), backgroundColor: _kGreenDark),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(16)),
      child: GridView.count(
        crossAxisCount: 4,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        childAspectRatio: 0.85,
        children: _kLayananItems.map((item) {
          return GestureDetector(
            onTap: () => _onTap(context, item.label),
            child: Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(14)),
                  child: Icon(item.icon, color: _kGreenDark, size: 22),
                ),
                const SizedBox(height: 6),
                Text(item.label, style: const TextStyle(fontSize: 10, color: Color(0xFF374151)), textAlign: TextAlign.center),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
