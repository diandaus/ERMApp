import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../models/ranap_patient.dart';
import 'diagnosa_tab.dart';
import 'jadwal_obat_tab.dart';
import 'lab_tab.dart';
import 'pemeriksaan_tab.dart';
import 'rad_tab.dart';
import 'resep_tab.dart';
import 'tindakan_tab.dart';

const kBorder = Color(0xFFE5E7EB);
const kSidebarGreen = Color(0xFF059669);

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
          backgroundColor: kSidebarGreen,
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
    return Scaffold(
      body: Row(
        children: [
          _Sidebar(patient: patient, onOpenJadwalObat: _openJadwalObat),
          Expanded(
            child: Column(
              children: [
                Container(
                  color: Colors.white,
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    labelColor: kSidebarGreen,
                    unselectedLabelColor: const Color(0xFF6B7280),
                    indicatorColor: kSidebarGreen,
                    labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    tabs: _tabs.map((t) => Tab(text: t)).toList(),
                  ),
                ),
                const Divider(height: 1, color: kBorder),
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
    );
  }
}

class _Sidebar extends StatelessWidget {
  final RanapPatient patient;
  final VoidCallback onOpenJadwalObat;
  const _Sidebar({required this.patient, required this.onOpenJadwalObat});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      decoration: const BoxDecoration(color: Colors.white, border: Border(right: BorderSide(color: kBorder))),
      child: SafeArea(
        // Tombol Jadwal Obat DIPISAH dari area scroll (melayang tetap di
        // bawah sidebar) — supaya selalu kelihatan walau daftar info
        // pasien di atasnya panjang & discroll, per arahan user.
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 4, 20, 0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          IconButton(icon: const Icon(Icons.arrow_back, color: Color(0xFF111827)), onPressed: () => Navigator.of(context).pop()),
                          const SizedBox(width: 4),
                          Container(
                            width: 56,
                            height: 56,
                            decoration: const BoxDecoration(color: Color(0xFFEFF6FF), shape: BoxShape.circle),
                            child: const Icon(Icons.person, size: 30, color: Color(0xFF2563EB)),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(patient.nmPasien, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
                          const SizedBox(height: 2),
                          Text(patient.umur, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                          if (patient.sudahPulang) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(999)),
                              child: const Text('Sudah Pulang', style: TextStyle(fontSize: 11, color: Color(0xFF991B1B))),
                            ),
                          ],
                          const SizedBox(height: 20),
                          const Divider(height: 1, color: kBorder),
                          const SizedBox(height: 16),
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
                  ],
                ),
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: kBorder))),
              child: OutlinedButton.icon(
                onPressed: onOpenJadwalObat,
                icon: const Icon(Icons.medication_outlined, size: 16, color: kSidebarGreen),
                label: const Text('Jadwal Obat', style: TextStyle(fontSize: 12, color: kSidebarGreen)),
                style: OutlinedButton.styleFrom(side: const BorderSide(color: kSidebarGreen), padding: const EdgeInsets.symmetric(vertical: 10)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 2),
          Text(value.isEmpty ? '-' : value, style: const TextStyle(fontSize: 13, color: Color(0xFF111827)), maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
