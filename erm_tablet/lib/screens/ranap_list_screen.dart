import 'package:flutter/material.dart';
import '../models/app_user.dart';
import '../models/ranap_patient.dart';
import '../services/ranap_service.dart';
import 'pasien_detail_screen.dart';

const kBorder = Color(0xFFE5E7EB);

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

  @override
  void initState() {
    super.initState();
    _load();
    _searchCtrl.addListener(() => setState(() {}));
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
    if (q.isEmpty) return _list;
    return _list.where((p) => p.nmPasien.toLowerCase().contains(q) || p.noRkmMedis.toLowerCase().contains(q) || p.kamar.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(body: _buildListPane());
  }

  void _openDetailFullScreen(RanapPatient patient) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(
          toolbarHeight: 44,
          backgroundColor: const Color(0xFF059669),
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
            color: const Color(0xFF059669),
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
                TextField(
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
