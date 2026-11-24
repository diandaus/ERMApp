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
import '../theme/app_theme.dart';

const kBorder = kLine;
const kSidebarGreen = kPrimary;

/// PasienDetailLandscapeScreen — versi LANDSCAPE dari PasienDetailScreen,
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
  static const _tabs = ['SOAP/CPPT', 'RESEP', 'LAB', 'RAD', 'TINDAKAN', 'DIAGNOSA'];
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

  @override
  Widget build(BuildContext context) {
    final patient = widget.patient;
    // Tema sama dgn LandscapeShell: navbar tosca selebar layar (kembali +
    // identitas pasien + Jadwal Obat), di bawahnya panel data pasien putih
    // & tab putih yg MENEMPEL di bawah navbar, konten di latar abu.
    return Scaffold(
      backgroundColor: kPrimaryDark,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _NavbarPasien(patient: patient, onOpenJadwalObat: _openJadwalObat),
            Expanded(
              child: Container(
                color: kBg,
                child: Row(
                  children: [
                    _Sidebar(patient: patient),
                    Expanded(
                      child: Column(
                        children: [
                          Container(
                            height: 48,
                            color: Colors.white,
                            child: TabBar(
                              controller: _tabController,
                              isScrollable: true,
                              tabAlignment: TabAlignment.start,
                              labelColor: kPrimaryDark,
                              unselectedLabelColor: kText,
                              indicatorColor: kPrimary,
                              indicatorWeight: 2.5,
                              indicatorSize: TabBarIndicatorSize.tab,
                              dividerColor: Colors.transparent,
                              labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                              unselectedLabelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w400),
                              tabs: _tabs.map((t) => Tab(text: t)).toList(),
                            ),
                          ),
                          Expanded(
                            child: TabBarView(
                              controller: _tabController,
                              children: [
                                PemeriksaanTab(user: widget.user, patient: patient),
                                ResepTab(patient: patient),
                                LabTab(patient: patient),
                                RadTab(patient: patient),
                                TindakanTab(patient: patient),
                                DiagnosaTab(patient: patient),
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
  const _NavbarPasien({required this.patient, required this.onOpenJadwalObat});

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
                Text(patient.nmPasien, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
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
  const _Sidebar({required this.patient});

  /// Panel data pasien — putih tanpa border/bayangan, judul "Data Pasien"
  /// setinggi 48 (sejajar baris tab), sama pola dgn sidebar "Menu".
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 250,
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
