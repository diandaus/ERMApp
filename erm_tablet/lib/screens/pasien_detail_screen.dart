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

const kHeaderGreen = Color(0xFF059669);

/// openJadwalObat — dipisah jadi fungsi top-level (bukan method di
/// PasienDetailScreen) supaya bisa dipanggil juga dari actions AppBar
/// milik RanapListScreen (tombol Jadwal Obat sejajar tombol back, rata
/// kanan), per arahan user — bukan cuma dari dalam header hijau.
void openJadwalObat(BuildContext context, {required AppUser user, required RanapPatient patient}) {
  Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => Scaffold(
      appBar: AppBar(
        title: const Text('Jadwal Obat', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
        backgroundColor: kHeaderGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: JadwalObatTab(user: user, patient: patient),
    ),
  ));
}

/// PasienDetailScreen — panel kanan RanapListScreen. Header identitas
/// pasien (padanan breadcrumb no_rawat|no_rkm_medis|nm_pasien|umur di web)
/// + tombol "Jadwal Obat" rata kanan (skrn terpisah, bukan tab — dibuka via
/// push ke layar sendiri) + baris tab SOAP/CPPT|RESEP|LAB|RAD|TINDAKAN|
/// DIAGNOSA. Semua 6 tab sudah fitur nyata (riwayat/read-only dulu) —
/// SOAP/CPPT|RESEP|LAB|RAD|TINDAKAN padanan tab activeTab di
/// PemeriksaanRanap.tsx (web, minus adime/resume/upload yg blm
/// prioritas); DIAGNOSA padanan DiagnosaTab.tsx (endpoint generik
/// no_rawat, sebelumnya cuma dipasang di Poli/IGD, di sini pertama kali
/// dipasang jg utk Ranap). Input/Buat Permintaan/Hapus (create/delete) di
/// semua tab kecuali SOAP/Jadwal Obat BELUM dibangun — nyusul di fase
/// berikutnya.
class PasienDetailScreen extends StatelessWidget {
  final AppUser user;
  final RanapPatient patient;
  const PasienDetailScreen({super.key, required this.user, required this.patient});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 6,
      child: Container(
        color: Colors.white,
        child: Column(
          children: [
            // Header identitas pasien — hijau, senada dgn header
            // RanapListScreen (kHeaderGreen). Baris tab dipisah di blok
            // putih di bawahnya, spt SegmentedButton di RanapListScreen.
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
              color: kHeaderGreen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Tombol Jadwal Obat DIPINDAH ke actions AppBar (sejajar
                  // tombol back, rata kanan — lihat RanapListScreen), tidak
                  // lagi di sini per arahan user.
                  Text(patient.nmPasien, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        _InfoChip(text: patient.noRawat),
                        _InfoChip(text: patient.noRkmMedis),
                        _InfoChip(text: patient.umur),
                        _InfoChip(text: patient.kamar),
                        _InfoChip(text: 'DPJP ${patient.nmDokter}'),
                        if (patient.sudahPulang) const _InfoChip(text: 'Sudah Pulang', color: Color(0xFFFEE2E2), textColor: Color(0xFF991B1B)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Tab aktif dibuat spt "tab folder" — pil putih sudut atas
            // membulat, sudut bawah lurus, nempel langsung ke konten
            // putih di bawahnya (tanpa jarak hijau tersisa di bawah tab).
            Container(
              color: kHeaderGreen,
              padding: const EdgeInsets.only(top: 6, left: 4, right: 4),
              child: const TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                indicator: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(topLeft: Radius.circular(12), topRight: Radius.circular(12)),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                indicatorPadding: EdgeInsets.zero,
                dividerColor: Colors.transparent,
                labelPadding: EdgeInsets.symmetric(horizontal: 14),
                labelColor: kHeaderGreen,
                unselectedLabelColor: Color(0xFFA7F3D0),
                labelStyle: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                tabs: [
                  Tab(height: 34, text: 'SOAP/CPPT'),
                  Tab(height: 34, text: 'RESEP'),
                  Tab(height: 34, text: 'LAB'),
                  Tab(height: 34, text: 'RAD'),
                  Tab(height: 34, text: 'TINDAKAN'),
                  Tab(height: 34, text: 'DIAGNOSA'),
                ],
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  PemeriksaanTab(user: user, patient: patient),
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
    );
  }
}

class _InfoChip extends StatelessWidget {
  final String text;
  final Color color;
  final Color textColor;
  const _InfoChip({required this.text, this.color = Colors.white, this.textColor = const Color(0xFF065F46)});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(999)),
      child: Text(text, style: TextStyle(fontSize: 11, color: textColor)),
    );
  }
}
