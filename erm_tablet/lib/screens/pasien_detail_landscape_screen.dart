import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../models/ranap_patient.dart';
import 'diagnosa_tab.dart' show DiagnosaTab;
import 'jadwal_obat_tab.dart' show JadwalObatTab;
import 'lab_tab.dart' show LabTab;
import 'pemeriksaan_tab.dart' show PemeriksaanTab;
import 'rad_tab.dart' show RadTab;
import 'resep_tab.dart' show ResepTab;
import 'tindakan_tab.dart' show TindakanTab;
import 'riwayat_perawatan_screen.dart' show RiwayatPerawatanScreen;
import '../services/akses_service.dart';
import '../theme/app_theme.dart';

const kBorder = kLine;
const kSidebarGreen = kPrimary;

/// PasienDetailLandscapeScreen — layar pemeriksaan Rawat Inap, dipakai
/// LANDSCAPE & PORTRAIT: portrait = panel Data Pasien jadi drawer kiri
/// (tombol ☰ sebelum tab), navbar dapat tombol "Riwayat Pasien" (langsung
/// buka riwayat) sebelum Jadwal Obat; tab & konten sama persis. (Dulu versi LANDSCAPE dari PasienDetailScreen,
/// per arahan user: info pasien pindah ke SIDEBAR kiri (bukan header
/// hijau di atas), padanan pola RanapTableScreen vs RanapListScreen
/// (sengaja file terpisah spy desain portrait yg sudah teriterasi tidak
/// ikut kesenggol). Tab SOAP/CPPT|RESEP|LAB|RAD|TINDAKAN|DIAGNOSA +
/// semua widget tab-nya PAKAI ULANG APA ADANYA (PemeriksaanTab dst) —
/// cuma kerangka/shell-nya yg beda, bukan isinya.
class PasienDetailLandscapeScreen extends StatefulWidget {
  final AppUser user;
  final RanapPatient patient;
  const PasienDetailLandscapeScreen({super.key, required this.user, required this.patient});

  @override
  State<PasienDetailLandscapeScreen> createState() => _PasienDetailLandscapeScreenState();
}

class _PasienDetailLandscapeScreenState extends State<PasienDetailLandscapeScreen> with SingleTickerProviderStateMixin {
  // Tab yg dinonaktifkan utk akun ini (Pengaturan > Aplikasi Tablet di
  // web, kunci 'ranap.*') disembunyikan; label & isi tab memakai syarat
  // yg sama (lihat TabBarView di build).
  static bool _on(String k) => AksesService.aktif('ranap.$k');
  final List<String> _tabs = [
    if (_on('soap')) 'Soap/CPPT',
    if (_on('resep')) 'Resep',
    if (_on('lab')) 'Lab',
    if (_on('rad')) 'Rad',
    if (_on('tindakan')) 'Tindakan',
    if (_on('diagnosa')) 'Diagnosa',
  ];
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _openJadwalObat() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(
          title: const Text('Jadwal Obat', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
          backgroundColor: kPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        body: JadwalObatTab(user: widget.user, patient: widget.patient),
      ),
    ));
  }

  // Portrait: panel Data Pasien jadi drawer kiri (tombol ☰ sebelum tab).
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  void _openRiwayat() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => RiwayatPerawatanScreen(noRkmMedis: widget.patient.noRkmMedis, nmPasien: widget.patient.nmPasien),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final patient = widget.patient;
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
    // Tema sama dgn LandscapeShell: navbar tosca selebar layar (kembali +
    // identitas pasien + Jadwal Obat), di bawahnya panel data pasien putih
    // & tab putih yg MENEMPEL di bawah navbar, konten di latar abu.
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: kPrimaryDark,
      drawer: isLandscape
          ? null
          : Drawer(
              width: 300,
              backgroundColor: Colors.white,
              shape: const RoundedRectangleBorder(),
              child: SafeArea(child: _Sidebar(patient: patient, width: 300, showRiwayat: false)),
            ),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _NavbarPasien(
              patient: patient,
              onOpenJadwalObat: _openJadwalObat,
              onRiwayat: isLandscape ? null : _openRiwayat,
            ),
            Expanded(
              child: Container(
                color: kBg,
                child: Row(
                  children: [
                    if (isLandscape) _Sidebar(patient: patient),
                    if (_tabs.isEmpty)
                      const Expanded(child: _SemuaTabNonaktif())
                    else
                    Expanded(
                      child: Column(
                        children: [
                          // Tab SAMA dgn Pemeriksaan Rawat Jalan: tinggi 44,
                          // font 16 (aktif tebal tosca), garis bawah 2.
                          Container(
                            height: 44,
                            width: double.infinity,
                            color: Colors.white,
                            padding: EdgeInsets.only(left: isLandscape ? 8 : 0),
                            child: Row(children: [
                              if (!isLandscape)
                                IconButton(
                                  tooltip: 'Data Pasien',
                                  onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                                  icon: const Icon(Icons.menu, size: 26, color: kText),
                                ),
                              Expanded(
                                child: TabBar(
                                  controller: _tabController,
                                  isScrollable: true,
                                  tabAlignment: TabAlignment.start,
                                  labelColor: kPrimary,
                                  unselectedLabelColor: kText,
                                  indicatorColor: kPrimary,
                                  indicatorWeight: 2,
                                  indicatorSize: TabBarIndicatorSize.tab,
                                  dividerColor: Colors.transparent,
                                  labelPadding: const EdgeInsets.symmetric(horizontal: 12),
                                  labelStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                                  unselectedLabelStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w400),
                                  tabs: _tabs.map((t) => Tab(height: 44, text: t)).toList(),
                                ),
                              ),
                            ]),
                          ),
                          Expanded(
                            child: TabBarView(
                              controller: _tabController,
                              children: [
                                if (_on('soap')) PemeriksaanTab(user: widget.user, patient: patient),
                                // Input/permintaan Rawat Inap (padanan PemeriksaanRanap.tsx):
                                // dokter = DPJP kunjungan (patient.kdDokter); tombol
                                // input hanya muncul kalau DPJP diketahui.
                                if (_on('resep')) ResepTab(patient: patient, kdDokter: patient.kdDokter),
                                if (_on('lab')) LabTab(patient: patient, kdDokter: patient.kdDokter, ranap: true),
                                if (_on('rad')) RadTab(patient: patient, kdDokter: patient.kdDokter, nmDokter: patient.nmDokter),
                                if (_on('tindakan')) TindakanTab(patient: patient, kdDokter: patient.kdDokter, userNip: widget.user.nip),
                                if (_on('diagnosa')) DiagnosaTab(patient: patient, bisaInput: true, ranap: true),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Navbar tosca detail pasien: ← kembali, avatar bulat, nama + pil info
/// (No. RM · umur), status Sudah Pulang, tombol Jadwal Obat di kanan.
class _NavbarPasien extends StatelessWidget {
  final RanapPatient patient;
  final VoidCallback onOpenJadwalObat;
  // Diisi (portrait) = tombol "Riwayat Pasien" (langsung buka riwayat).
  final VoidCallback? onRiwayat;
  const _NavbarPasien({required this.patient, required this.onOpenJadwalObat, this.onRiwayat});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      color: kPrimary,
      child: Row(
        children: [
          IconButton(
            tooltip: 'Kembali',
            icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
            onPressed: () => Navigator.of(context).pop(),
          ),
          const SizedBox(width: 6),
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
            child: const Icon(Icons.person, size: 24, color: kPrimaryDark),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(patient.nmPasien, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    _pil('No. RM ${patient.noRkmMedis} · ${patient.umur}'),
                    if (patient.sudahPulang) ...[
                      const SizedBox(width: 6),
                      _pil('Sudah Pulang', dot: const Color(0xFFEF4444)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (onRiwayat != null) ...[
            _tombol(Icons.history, 'Riwayat Pasien', onRiwayat!),
            const SizedBox(width: 10),
          ],
          Material(
            color: kPrimaryDark,
            borderRadius: BorderRadius.circular(6),
            child: InkWell(
              onTap: onOpenJadwalObat,
              borderRadius: BorderRadius.circular(6),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    Icon(Icons.medication_outlined, size: 20, color: Colors.white),
                    SizedBox(width: 8),
                    Text('Jadwal Obat', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                    SizedBox(width: 4),
                    Icon(Icons.chevron_right, size: 20, color: Colors.white),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tombol(IconData icon, String label, VoidCallback onTap) => Material(
        color: kPrimaryDark,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              Icon(icon, size: 20, color: Colors.white),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
            ]),
          ),
        ),
      );

  Widget _pil(String text, {Color? dot}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (dot != null) ...[
              Container(width: 7, height: 7, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
              const SizedBox(width: 5),
            ],
            Text(text, style: const TextStyle(fontSize: 11, color: kText)),
          ],
        ),
      );
}

class _Sidebar extends StatelessWidget {
  final RanapPatient patient;
  final double width;
  // false = drawer portrait (Riwayat Pasien sudah ada di navbar).
  final bool showRiwayat;
  const _Sidebar({required this.patient, this.width = 250, this.showRiwayat = true});

  /// Panel data pasien — putih tanpa border/bayangan, judul "Data Pasien"
  /// setinggi 48 (sejajar baris tab), sama pola dgn sidebar "Menu".
  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 48,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            alignment: Alignment.centerLeft,
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: kLine))),
            child: const Text('Data Pasien', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: kText)),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _infoRow('No. RM', patient.noRkmMedis),
                  _infoRow('No. Rawat', patient.noRawat),
                  _infoRow('Tanggal Lahir', patient.tglLahir),
                  _infoRow('Jenis Kelamin', patient.jkLabel),
                  _infoRow('Alamat', patient.alamat),
                  _infoRow('Pekerjaan', patient.pekerjaan),
                  _infoRow('Kamar', patient.kamar),
                  _infoRow('DPJP', patient.nmDokter),
                  _infoRow('Jenis Bayar', patient.pngJawab.isEmpty ? '-' : patient.pngJawab),
                  _infoRow('Tgl Masuk', '${patient.tglMasuk} ${patient.jamMasuk}'.trim()),
                  if (patient.sudahPulang) _infoRow('Tgl Pulang', patient.tglKeluar.isEmpty ? '-' : patient.tglKeluar),
                ],
              ),
            ),
          ),
          // Tombol "Riwayat Pasien" — bar tosca penuh MENEMPEL di dasar panel
          // (gaya tombol "Bayar" di referensi): teks putih kiri, › kanan.
          if (showRiwayat)
          Material(
            color: kPrimary,
            child: InkWell(
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => RiwayatPerawatanScreen(noRkmMedis: patient.noRkmMedis, nmPasien: patient.nmPasien),
              )),
              child: const SizedBox(
                height: 64,
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Icon(Icons.history, color: Colors.white, size: 22),
                      SizedBox(width: 10),
                      Expanded(child: Text('Riwayat Pasien', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white))),
                      Icon(Icons.chevron_right, color: Colors.white, size: 24),
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

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: kTextMuted)),
          const SizedBox(height: 2),
          Text(value.isEmpty ? '-' : value, style: const TextStyle(fontSize: 13, color: kText), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

/// Semua tab pemeriksaan dinonaktifkan utk akun ini.
class _SemuaTabNonaktif extends StatelessWidget {
  const _SemuaTabNonaktif();
  @override
  Widget build(BuildContext context) => const Center(
        child: Text('Tidak ada tab pemeriksaan yang diaktifkan untuk akun ini.\nHubungi admin (Pengaturan > Aplikasi Tablet).',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 15, color: kTextMuted)),
      );
}
