import 'package:flutter/material.dart';
import '../models/rad_item.dart';
import '../models/ranap_patient.dart';
import '../services/api_config.dart';
import '../services/api_client.dart';
import '../services/rad_service.dart';
import '../widgets/usg_input_panel.dart';

const kBorder = Color(0xFFE5E7EB);

/// RadTab — Radiologi Rawat Inap (read-only dulu, sama pola dgn ResepTab/
/// LabTab), padanan RadTab.tsx (web): Riwayat Permintaan (blm ada hasil) +
/// Pemeriksaan Radiologi + Bacaan/Hasil Radiologi + Gambar Radiologi.
/// Endpoint SAMA PERSIS (/api/radiologi/riwayat, /api/radiologi-data),
/// tidak ada endpoint baru. Buat Permintaan Radiologi (ModalInputRad.tsx)
/// BELUM dibangun di v1 tablet ini — nyusul di fase berikutnya spt Resep.
class RadTab extends StatefulWidget {
  final RanapPatient patient;
  // true = tab "USG" (padanan RadTab.tsx kategoriUsg): cuma data USG.
  final bool kategoriUsg;
  // Cuma dipakai tab USG (Input Hasil / Kirim Modality Worklist): dokter
  // poliklinik kunjungan ini (jadi Dokter P.J. sekaligus perujuk) & NIP
  // akun yg login (petugas default).
  final String kdDokter;
  final String nmDokter;
  final String userNip;
  // true = kartu/tabel putih radius 4 (layar pemeriksaan Rawat Jalan),
  // sama dgn ResepTab(ralan).
  final bool flat;
  const RadTab({super.key, required this.patient, this.flat = false, this.kategoriUsg = false, this.kdDokter = '', this.nmDokter = '', this.userNip = ''});

  @override
  State<RadTab> createState() => _RadTabState();
}

class _RadTabState extends State<RadTab> {
  bool _loading = true;
  String? _error;
  List<RadPermintaanItem> _pending = [];
  RadiologiData _data = RadiologiData(pemeriksaan: [], hasil: [], gambar: []);
  bool _preparingHasil = false;
  bool _sendingMwl = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final noRawat = widget.patient.noRawat;
      final results = await Future.wait([RadService.getRiwayat(noRawat, usg: widget.kategoriUsg), RadService.getData(noRawat, usg: widget.kategoriUsg)]);
      final riwayat = results[0] as List<RadPermintaanItem>;
      final data = results[1] as RadiologiData;
      if (!mounted) return;
      setState(() {
        _pending = riwayat.where((it) => !it.sudahAdaHasil).toList();
        _data = data;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = widget.kategoriUsg ? 'Gagal mengambil data USG' : 'Gagal mengambil data radiologi';
        _loading = false;
      });
    }
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? const Color(0xFFDC2626) : const Color(0xFF16A34A)));
  }

  String _errText(Object e) => e is ApiException ? e.message : 'Terjadi kesalahan';

  /// Dipakai BERSAMA "Input Hasil Pemeriksaan USG" & "Kirim Modality
  /// Worklist" (padanan ensurePendingUsgOrder di RadTab.tsx): kalau sudah
  /// ada permintaan USG pending, pakai yg pertama (terbaru); kalau belum,
  /// buat OTOMATIS dgn jenis pemeriksaan kode RJ.OBG — dicocokkan PERSIS
  /// ke kd_jenis_prw spy di instalasi yg kodenya beda gagal dgn jelas,
  /// bukan salah pilih. Perujuk = dokter poliklinik kunjungan ini.
  Future<String> _ensurePendingUsgOrder() async {
    if (_pending.isNotEmpty) return _pending.first.noorder;

    const kdJenisUsg = 'RJ.OBG';
    final cari = await RadService.searchJenisPerawatan(kdJenisUsg);
    final usg = cari.where((x) => '${x['kd_jenis_prw'] ?? ''}'.trim().toUpperCase() == kdJenisUsg).firstOrNull;
    if (usg == null) throw ApiException(404, 'Jenis pemeriksaan USG (kode $kdJenisUsg) tidak ditemukan di Master Data Radiologi.');

    var status = 'ralan';
    try {
      final info = await RadService.getInfoRawat(widget.patient.noRawat);
      final s = info['status'] as String? ?? '';
      if (s.isNotEmpty) status = s;
    } catch (_) {/* default ralan, sama dgn web */}

    final now = DateTime.now();
    String pad(int n) => n.toString().padLeft(2, '0');
    final noorder = await RadService.createPermintaan({
      'no_rawat': widget.patient.noRawat,
      'dokter_perujuk': widget.kdDokter,
      'status': status,
      'diagnosis_klinis': 'USG',
      'informasi_tambahan': '',
      'pemeriksaan_list': [usg['kd_jenis_prw']],
      'tgl_permintaan': '${now.year}-${pad(now.month)}-${pad(now.day)}',
      'jam_permintaan': '${pad(now.hour)}:${pad(now.minute)}:${pad(now.second)}',
    });
    _load();
    return noorder;
  }

  Future<void> _inputHasilUsg() async {
    setState(() => _preparingHasil = true);
    String noorder;
    try {
      noorder = await _ensurePendingUsgOrder();
    } catch (e) {
      if (mounted) _toast(_errText(e), error: true);
      return;
    } finally {
      if (mounted) setState(() => _preparingHasil = false);
    }
    if (!mounted) return;
    final p = widget.patient;
    final saved = await showUsgInputPanel(context, noorder: noorder, noRawat: p.noRawat, noRkmMedis: p.noRkmMedis, nmPasien: p.nmPasien, umur: p.umur, kdDokter: widget.kdDokter, nmDokter: widget.nmDokter, userNip: widget.userNip);
    if (!mounted) return;
    if (saved) _toast('Hasil pemeriksaan USG berhasil disimpan');
    // Dimuat ulang walau batal: permintaannya bisa saja baru dibuat.
    await _load();
  }

  /// Kirim permintaan USG pending ke Modality Worklist (Orthanc) spy
  /// AccessionNumber & identitas pasien tidak diketik ulang di mesin USG.
  /// Yg statusnya sudah 'terkirim' tidak dikirim ulang.
  Future<void> _kirimModalityWorklist() async {
    setState(() => _sendingMwl = true);
    try {
      final noorder = await _ensurePendingUsgOrder();
      var status = '';
      try {
        status = await RadService.getMwlStatus(noorder);
      } catch (_) {/* status tak diketahui -> tetap ditawarkan kirim */}
      if (!mounted) return;
      if (status == 'terkirim') {
        _toast('Permintaan USG pasien ini sudah ada di Modality Worklist.');
        return;
      }
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Kirim permintaan USG ke Modality Worklist?'),
          content: const Text('AccessionNumber & identitas pasien otomatis terisi — tidak perlu diketik ulang manual di mesin USG.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
            TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Ya, Kirim')),
          ],
        ),
      );
      if (ok != true || !mounted) return;
      await RadService.sendMwl(noorder);
      if (mounted) _toast('Permintaan USG berhasil dikirim ke Modality Worklist');
    } catch (e) {
      if (mounted) _toast(_errText(e), error: true);
    } finally {
      if (mounted) setState(() => _sendingMwl = false);
    }
  }

  Future<void> _batalkan(RadPermintaanItem item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus Permintaan Radiologi?'),
        content: Text('Apakah Anda yakin ingin menghapus permintaan ${item.noorder}?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Ya, Hapus', style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await RadService.deletePermintaan(item.noorder);
      if (!mounted) return;
      _toast('Permintaan radiologi berhasil dihapus');
      await _load();
    } catch (e) {
      if (mounted) _toast(_errText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Tombol aksi baru ada di tab USG; tab Radiologi biasa tetap riwayat.
    if (!widget.kategoriUsg) return _buildContent();
    const green = Color(0xFF059669);
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(2));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ElevatedButton.icon(
                onPressed: _preparingHasil ? null : _inputHasilUsg,
                icon: const Icon(Icons.add, size: 16, color: Colors.white),
                label: Text(_preparingHasil ? 'Menyiapkan...' : 'Input Hasil Pemeriksaan USG', style: const TextStyle(fontSize: 13)),
                style: ElevatedButton.styleFrom(backgroundColor: green, foregroundColor: Colors.white, elevation: 0, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), shape: shape),
              ),
              OutlinedButton.icon(
                onPressed: _sendingMwl ? null : _kirimModalityWorklist,
                icon: Icon(Icons.send_outlined, size: 16, color: _sendingMwl ? const Color(0xFF9CA3AF) : green),
                label: Text(_sendingMwl ? 'Mengirim...' : 'Kirim Modality Worklist', style: TextStyle(fontSize: 13, color: _sendingMwl ? const Color(0xFF9CA3AF) : green)),
                style: OutlinedButton.styleFrom(backgroundColor: Colors.white, side: const BorderSide(color: green), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), shape: shape),
              ),
            ],
          ),
        ),
        Expanded(child: _buildContent()),
      ],
    );
  }

  Widget _buildContent() {
    final kosong = _pending.isEmpty && _data.isEmpty;
    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
              : kosong
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        const SizedBox(height: 60),
                        const Icon(Icons.image_search_outlined, size: 40, color: Color(0xFF9CA3AF)),
                        const SizedBox(height: 12),
                        Center(child: Text(widget.kategoriUsg ? 'Belum Ada Data USG' : 'Belum Ada Data Radiologi', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151)))),
                        const SizedBox(height: 4),
                        Center(child: Text('Belum ada permintaan atau hasil ${widget.kategoriUsg ? 'USG' : 'radiologi'} untuk pasien ini.', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center)),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_pending.isNotEmpty) ...[
                          const Text('Riwayat Permintaan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          ..._pending.map((it) => _PermintaanCard(item: it, flat: widget.flat, onBatalkan: widget.kategoriUsg ? () => _batalkan(it) : null)),
                          const SizedBox(height: 16),
                        ],
                        if (_data.pemeriksaan.isNotEmpty) ...[
                          const _SectionHeader(title: 'Pemeriksaan Radiologi', color: Color(0xFF1E40AF), bg: Color(0xFFDBEAFE)),
                          const SizedBox(height: 8),
                          _PemeriksaanTable(items: _data.pemeriksaan, flat: widget.flat),
                          const SizedBox(height: 16),
                        ],
                        if (_data.hasil.isNotEmpty) ...[
                          const _SectionHeader(title: 'Bacaan / Hasil Radiologi', color: Color(0xFF065F46), bg: Color(0xFFD1FAE5)),
                          const SizedBox(height: 8),
                          ..._data.hasil.map((h) => _HasilCard(item: h, flat: widget.flat)),
                          const SizedBox(height: 16),
                        ],
                        if (_data.gambar.isNotEmpty) ...[
                          const _SectionHeader(title: 'Gambar Radiologi', color: Color(0xFF7C2D12), bg: Color(0xFFFFEDD5)),
                          const SizedBox(height: 8),
                          ..._data.gambar.map((g) => _GambarCard(item: g, flat: widget.flat)),
                        ],
                      ],
                    ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final Color color;
  final Color bg;
  const _SectionHeader({required this.title, required this.color, required this.bg});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _PermintaanCard extends StatelessWidget {
  final RadPermintaanItem item;
  // Diisi = tampilkan tombol "Batalkan" (baru dipakai tab USG).
  final VoidCallback? onBatalkan;
  final bool flat;
  const _PermintaanCard({required this.item, this.onBatalkan, this.flat = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: flat ? Colors.white : null, border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(flat ? 4 : 8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('No. Permintaan: ${item.noorder}', style: const TextStyle(fontSize: 12, color: Color(0xFF1AB1E5)))),
              if (onBatalkan != null)
                InkWell(
                  onTap: onBatalkan,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    color: const Color(0xFFEF4444),
                    child: const Text('Batalkan', style: TextStyle(fontSize: 12, color: Colors.white)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text('${item.tglPermintaan} ${item.jamPermintaan}'.trim(), style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          Text(item.nmDokter.isEmpty ? '-' : item.nmDokter, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 8),
          Text('Diagnosis: ${item.diagnosaKlinis.isEmpty ? '-' : item.diagnosaKlinis}', style: const TextStyle(fontSize: 12)),
          if (item.informasiTambahan.isNotEmpty) Text('Info Tambahan: ${item.informasiTambahan}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          if (item.detailPemeriksaan.isNotEmpty) ...[
            const Padding(padding: EdgeInsets.only(top: 10, bottom: 6), child: Divider(height: 1, color: kBorder)),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: item.detailPemeriksaan
                  .map((d) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: const Color(0xFFE0F2FE), border: Border.all(color: const Color(0xFF1AB1E5)), borderRadius: BorderRadius.circular(999)),
                        child: Text(d.nmPerawatan.isEmpty ? d.kdJenisPrw : d.nmPerawatan, style: const TextStyle(fontSize: 12, color: Color(0xFF0891B2))),
                      ))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _PemeriksaanTable extends StatelessWidget {
  final List<RadiologiPemeriksaan> items;
  final bool flat;
  const _PemeriksaanTable({required this.items, this.flat = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: flat ? Colors.white : null, border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(flat ? 4 : 8)),
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: const {0: FlexColumnWidth(2), 1: FlexColumnWidth(3), 2: FlexColumnWidth(2), 3: FlexColumnWidth(2)},
        children: [
          TableRow(
            decoration: BoxDecoration(color: flat ? Colors.white : const Color(0xFFF3F4F6)),
            children: ['Tanggal/Jam', 'Nama Pemeriksaan', 'Dokter PJ', 'Biaya'].map((h) => _cell(h, color: const Color(0xFF374151))).toList(),
          ),
          for (final p in items)
            TableRow(children: [
              _cell('${p.tglPeriksa} ${p.jam}'.trim(), color: const Color(0xFF6B7280)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.nmPerawatan.isEmpty ? '-' : p.nmPerawatan, style: const TextStyle(fontSize: 11, color: Color(0xFF111827))),
                    if (p.proyeksi.isNotEmpty) Text(p.proyeksi, style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
                  ],
                ),
              ),
              _cell(p.nmDokter.isEmpty ? '-' : p.nmDokter, color: const Color(0xFF6B7280)),
              _cell(p.biaya > 0 ? 'Rp ${_thousands(p.biaya)}' : '-', color: const Color(0xFF374151)),
            ]),
        ],
      ),
    );
  }

  Widget _cell(String text, {required Color color}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(text, style: TextStyle(fontSize: 11, color: color)),
      );

  String _thousands(num v) {
    final s = v.toInt().toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class _HasilCard extends StatelessWidget {
  final RadiologiHasil item;
  final bool flat;
  const _HasilCard({required this.item, this.flat = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: flat ? Colors.white : const Color(0xFFF9FAFB), border: flat ? Border.all(color: kBorder) : null, borderRadius: BorderRadius.circular(flat ? 4 : 8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${item.tglPeriksa} ${item.jam}'.trim(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const SizedBox(height: 4),
          Text(item.hasil.isEmpty ? '-' : item.hasil, style: const TextStyle(fontSize: 12, height: 1.5)),
        ],
      ),
    );
  }
}

class _GambarCard extends StatelessWidget {
  final RadiologiGambar item;
  final bool flat;
  const _GambarCard({required this.item, this.flat = false});

  String get _url => item.lokasiGambar.isEmpty ? '' : '$kApiBaseUrl/radiologi/${item.lokasiGambar}';

  @override
  Widget build(BuildContext context) {
    if (_url.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: flat ? Colors.white : null, border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(flat ? 4 : 8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${item.tglPeriksa} ${item.jam}'.trim(), style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: () => _openZoom(context),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.network(
                _url,
                height: 200,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(height: 120, color: const Color(0xFFF3F4F6), alignment: Alignment.center, child: const Icon(Icons.broken_image_outlined, color: Color(0xFF9CA3AF))),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openZoom(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: InteractiveViewer(child: Image.network(_url)),
      ),
    );
  }
}
