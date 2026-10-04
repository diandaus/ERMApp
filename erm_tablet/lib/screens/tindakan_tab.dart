import 'package:flutter/material.dart';
import '../models/ranap_patient.dart';
import '../models/tindakan_item.dart';
import '../services/api_client.dart';
import '../services/tindakan_service.dart';
import '../widgets/tindakan_input_panel.dart';

const kBorder = Color(0xFFE5E7EB);

/// TindakanTab — Tindakan Rawat Inap (read-only dulu, sama pola dgn
/// ResepTab/LabTab/RadTab), padanan TindakanTab.tsx (web, isRanap=true):
/// 3 tabel terpisah — Tindakan Dokter, Tindakan Perawat, Tindakan Dokter &
/// Perawat (padanan 3 tabel DlgRawatJalan.java). Endpoint SAMA PERSIS
/// (/api/tindakan-ranap/:no_rawat), tidak ada endpoint baru. Input Tindakan
/// (ModalInputTindakan.tsx) BELUM dibangun di v1 tablet ini — nyusul di
/// fase berikutnya spt Resep/Lab/Rad.
class TindakanTab extends StatefulWidget {
  final RanapPatient patient;
  // true = Rawat Jalan (/api/tindakan-ralan), dipakai PemeriksaanRalanScreen.
  final bool ralan;
  // Cuma dipakai Rawat Jalan (Input Tindakan): dokter & cara bayar
  // kunjungan ini, dan NIP akun yg login (petugas default).
  final String kdDokter;
  final String kdPj;
  final String userNip;
  const TindakanTab({super.key, required this.patient, this.ralan = false, this.kdDokter = '', this.kdPj = '', this.userNip = ''});

  @override
  State<TindakanTab> createState() => _TindakanTabState();
}

class _TindakanTabState extends State<TindakanTab> {
  bool _loading = true;
  String? _error;
  TindakanRanapResult _data = TindakanRanapResult(tindakanDokter: [], tindakanParamedis: [], tindakanDokterParamedis: []);

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
      final data = await TindakanService.getList(widget.patient.noRawat, ralan: widget.ralan);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal mengambil riwayat tindakan';
        _loading = false;
      });
    }
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? const Color(0xFFDC2626) : const Color(0xFF16A34A)));
  }

  Future<void> _openInput() async {
    final p = widget.patient;
    final saved = await showTindakanInputPanel(context, noRawat: p.noRawat, noRkmMedis: p.noRkmMedis, nmPasien: p.nmPasien, umur: p.umur, kdDokter: widget.kdDokter, kdPj: widget.kdPj, userNip: widget.userNip);
    if (!saved || !mounted) return;
    _toast('Tindakan berhasil disimpan');
    await _load();
  }

  /// Hapus satu baris tindakan — [endpoint] & [params] (kunci baris)
  /// beda per kelompok, padanan handleDeleteTindakan* di TindakanTab.tsx.
  Future<void> _hapus(String nmPerawatan, String endpoint, Map<String, String> params) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hapus Tindakan?'),
        content: Text('Apakah Anda yakin ingin menghapus tindakan "$nmPerawatan"?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Batal')),
          TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Ya, Hapus', style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await TindakanService.hapus(endpoint, {'no_rawat': widget.patient.noRawat, ...params});
      if (!mounted) return;
      _toast('Tindakan berhasil dihapus');
      await _load();
    } catch (e) {
      if (mounted) _toast(e is ApiException ? e.message : 'Gagal menghapus tindakan', error: true);
    }
  }

  /// Tindakan Dokter: tgl_perawatan ISO -> ambil bagian tanggalnya.
  void _hapusDokter(TindakanDokterItem it) => _hapus(it.nmPerawatan, 'delete', {
        'kd_jenis_prw': it.kdJenisPrw,
        'tgl_perawatan': it.tglPerawatan.split('T').first,
        'jam_rawat': it.jamRawat,
        'kd_dokter': it.kdDokter,
      });

  /// Perawat / Dokter & Perawat: tgl_perawatan DD/MM/YYYY -> YYYY-MM-DD.
  /// [drpr] true = kelompok Dokter & Perawat (kuncinya kd_dokter + nip).
  void _hapusParamedis(TindakanParamedisItem it, {required bool drpr}) {
    final parts = it.tglPerawatan.split('/');
    final tgl = parts.length == 3 ? '${parts[2]}-${parts[1]}-${parts[0]}' : it.tglPerawatan;
    _hapus(it.nmPerawatan, drpr ? 'delete-dokter-petugas' : 'delete-petugas', {
      'kd_jenis_prw': it.kdJenisPrw,
      'tgl_perawatan': tgl,
      'jam_rawat': it.jamRawat,
      if (drpr) 'kd_dokter': it.kdDokter,
      'nip': it.nip,
    });
  }

  @override
  Widget build(BuildContext context) {
    // Input/Hapus baru ada utk Rawat Jalan; Rawat Inap tetap riwayat saja.
    if (!widget.ralan) return _buildContent();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: ElevatedButton.icon(
            onPressed: _openInput,
            icon: const Icon(Icons.add, size: 16, color: Colors.white),
            label: const Text('Input Tindakan', style: TextStyle(fontSize: 13)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
            ),
          ),
        ),
        Expanded(child: _buildContent()),
      ],
    );
  }

  Widget _buildContent() {
    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
              : _data.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: const [
                        SizedBox(height: 60),
                        Icon(Icons.medical_services_outlined, size: 40, color: Color(0xFF9CA3AF)),
                        SizedBox(height: 12),
                        Center(child: Text('Belum Ada Riwayat Tindakan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF374151)))),
                        SizedBox(height: 4),
                        Center(child: Text('Belum ada riwayat tindakan untuk pasien ini.', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)), textAlign: TextAlign.center)),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_data.tindakanDokter.isNotEmpty) ...[
                          const Text('Tindakan Dokter', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          _dokterTable(_data.tindakanDokter),
                          const SizedBox(height: 16),
                        ],
                        if (_data.tindakanParamedis.isNotEmpty) ...[
                          const Text('Tindakan Perawat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          _paramedisTable(_data.tindakanParamedis, drpr: false),
                          const SizedBox(height: 16),
                        ],
                        if (_data.tindakanDokterParamedis.isNotEmpty) ...[
                          const Text('Tindakan Dokter & Perawat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          _paramedisTable(_data.tindakanDokterParamedis, drpr: true),
                        ],
                      ],
                    ),
    );
  }

  Widget _dokterTable(List<TindakanDokterItem> items) {
    return Container(
      decoration: _tableBox,
      clipBehavior: Clip.antiAlias,
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: {0: const FlexColumnWidth(3), 1: const FlexColumnWidth(2), if (widget.ralan) 2: const FixedColumnWidth(_aksiWidth)},
        defaultVerticalAlignment: TableCellVerticalAlignment.middle,
        children: [
          TableRow(
            decoration: BoxDecoration(color: widget.ralan ? Colors.white : const Color(0xFFF3F4F6)),
            children: [_cell('Perawatan/Tindakan', color: const Color(0xFF374151)), _cell('Biaya', color: const Color(0xFF374151)), if (widget.ralan) _cell('Aksi', color: const Color(0xFF374151), align: TextAlign.center)],
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.nmPerawatan.isEmpty ? '-' : it.nmPerawatan, color: const Color(0xFF111827)),
              _cell(_rupiah(it.biayaRawat), color: const Color(0xFF111827), align: TextAlign.right),
              if (widget.ralan) _hapusButton(() => _hapusDokter(it)),
            ]),
        ],
      ),
    );
  }

  /// [drpr] true = kelompok Dokter & Perawat (endpoint hapusnya beda).
  Widget _paramedisTable(List<TindakanParamedisItem> items, {required bool drpr}) {
    return Container(
      decoration: _tableBox,
      clipBehavior: Clip.antiAlias,
      child: Table(
        border: TableBorder.symmetric(inside: const BorderSide(color: kBorder)),
        columnWidths: {0: const FlexColumnWidth(3), 1: const FlexColumnWidth(2), 2: const FlexColumnWidth(2), if (widget.ralan) 3: const FixedColumnWidth(_aksiWidth)},
        defaultVerticalAlignment: TableCellVerticalAlignment.middle,
        children: [
          TableRow(
            decoration: BoxDecoration(color: widget.ralan ? Colors.white : const Color(0xFFF3F4F6)),
            children: [
              ...['Perawatan/Tindakan', 'Petugas Yg Menangani', 'Biaya'].map((h) => _cell(h, color: const Color(0xFF374151))),
              if (widget.ralan) _cell('Aksi', color: const Color(0xFF374151), align: TextAlign.center),
            ],
          ),
          for (final it in items)
            TableRow(children: [
              _cell(it.nmPerawatan.isEmpty ? '-' : it.nmPerawatan, color: const Color(0xFF111827)),
              _cell(it.namaParamedis.isEmpty ? '-' : it.namaParamedis, color: const Color(0xFF374151)),
              _cell(_rupiah(it.biayaRawat), color: const Color(0xFF111827), align: TextAlign.right),
              if (widget.ralan) _hapusButton(() => _hapusParamedis(it, drpr: drpr)),
            ]),
        ],
      ),
    );
  }

  static const double _aksiWidth = 76;

  // Rawat Jalan (latar layar abu): tabel putih radius 4, seragam dgn kartu
  // di tab SOAP/Resep; Rawat Inap tetap gaya lamanya.
  BoxDecoration get _tableBox => BoxDecoration(color: widget.ralan ? Colors.white : null, border: Border.all(color: kBorder), borderRadius: BorderRadius.circular(widget.ralan ? 4 : 8));

  Widget _hapusButton(VoidCallback onPressed) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: InkWell(
            onTap: onPressed,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              color: const Color(0xFFEF4444),
              child: const Text('Hapus', style: TextStyle(fontSize: 11, color: Colors.white)),
            ),
          ),
        ),
      );

  Widget _cell(String text, {required Color color, TextAlign align = TextAlign.left}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(text, textAlign: align, style: TextStyle(fontSize: 11, color: color)),
      );

  String _rupiah(num v) {
    final s = v.toInt().toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return 'Rp $buf';
  }
}
