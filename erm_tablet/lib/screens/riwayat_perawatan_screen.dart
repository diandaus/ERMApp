import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/api_config.dart';
import '../services/riwayat_perawatan_service.dart';

const _kBorder = Color(0xFFE5E7EB);
const _kGreen = Color(0xFF059669);
const _kText = TextStyle(fontSize: 12, color: Color(0xFF111827));
const _kMuted = TextStyle(fontSize: 12, color: Color(0xFF6B7280));

/// RiwayatPerawatanScreen — Riwayat Perawatan pasien (fullscreen), padanan
/// RiwayatModal.tsx (web): biodata + daftar SEMUA kunjungan, tiap
/// kunjungan berisi diagnosa/prosedur, pemeriksaan (SOAP) ralan & ranap,
/// tindakan, pemberian obat, radiologi, dan laboratorium.
///
/// Beda dari web: detail kunjungan dimuat SAAT kartunya dibuka (web
/// memuat detail semua kunjungan sekaligus di awal — 9 permintaan per
/// kunjungan, terlalu berat utk tablet), kunjungan pertama langsung
/// terbuka. Triase & Pengkajian Awal Medis IGD BELUM ditampilkan.
class RiwayatPerawatanScreen extends StatefulWidget {
  final String noRkmMedis;
  final String nmPasien;
  const RiwayatPerawatanScreen({super.key, required this.noRkmMedis, required this.nmPasien});

  @override
  State<RiwayatPerawatanScreen> createState() => _RiwayatPerawatanScreenState();
}

class _RiwayatPerawatanScreenState extends State<RiwayatPerawatanScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _bio = {};
  List<Map<String, dynamic>> _riwayat = [];

  final Set<String> _expanded = {};
  final Map<String, RiwayatKunjunganDetail> _detail = {};
  final Set<String> _loadingDetail = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await RiwayatPerawatanService.getRiwayat(widget.noRkmMedis);
      if (!mounted) return;
      setState(() {
        _bio = data['pasien'] as Map<String, dynamic>? ?? {};
        _riwayat = (data['riwayat'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();
        _loading = false;
      });
      if (_riwayat.isNotEmpty) _toggle('${_riwayat.first['no_rawat'] ?? ''}');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : 'Gagal memuat riwayat perawatan';
        _loading = false;
      });
    }
  }

  Future<void> _toggle(String noRawat) async {
    if (_expanded.contains(noRawat)) {
      setState(() => _expanded.remove(noRawat));
      return;
    }
    setState(() => _expanded.add(noRawat));
    if (_detail.containsKey(noRawat) || _loadingDetail.contains(noRawat)) return;
    setState(() => _loadingDetail.add(noRawat));
    final detail = await RiwayatPerawatanService.getDetail(noRawat);
    if (!mounted) return;
    setState(() {
      _detail[noRawat] = detail;
      _loadingDetail.remove(noRawat);
    });
  }

  String _s(Map<String, dynamic> m, String key) => '${m[key] ?? ''}';

  List<Map<String, dynamic>> _list(Map<String, dynamic> m, String key) => (m[key] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF374151),
        elevation: 0,
        scrolledUnderElevation: 0,
        toolbarHeight: 52,
        titleSpacing: 0,
        title: Text('Riwayat Perawatan  ·  ${widget.nmPasien}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        shape: const Border(bottom: BorderSide(color: _kBorder)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)))))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _sectionTitle('Data Riwayat Perawatan Pasien'),
                    _buildBio(),
                    const SizedBox(height: 16),
                    _sectionTitle('Data Riwayat'),
                    if (_riwayat.isEmpty)
                      const Padding(padding: EdgeInsets.all(20), child: Center(child: Text('Belum ada riwayat perawatan', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
                    else
                      for (final k in _riwayat) _buildKunjungan(k),
                  ],
                ),
    );
  }

  Widget _sectionTitle(String text) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF111827))));

  BoxDecoration get _card => BoxDecoration(color: Colors.white, border: Border.all(color: _kBorder), borderRadius: BorderRadius.circular(4));

  Widget _kv(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 150, child: Text(label, style: _kMuted)),
            const Text(':  ', style: _kMuted),
            Expanded(child: Text(value.isEmpty ? '-' : value, style: _kText)),
          ],
        ),
      );

  Widget _buildBio() {
    final jk = _s(_bio, 'jk');
    final left = [
      _kv('No.RM', _s(_bio, 'no_rkm_medis')),
      _kv('Nama Pasien', _s(_bio, 'nm_pasien')),
      _kv('Alamat', _s(_bio, 'alamat')),
      _kv('Umur', '${_s(_bio, 'umur')} (${jk == 'L' ? 'Laki-Laki' : 'Perempuan'})'),
      _kv('Tanggal Lahir', _s(_bio, 'tgl_lahir')),
      _kv('Ibu Kandung', _s(_bio, 'nm_ibu')),
    ];
    final right = [
      _kv('Golongan Darah', _s(_bio, 'gol_darah')),
      _kv('Status Nikah', _s(_bio, 'stts_nikah')),
      _kv('Agama', _s(_bio, 'agama')),
      _kv('Pendidikan Terakhir', _s(_bio, 'pnd')),
      _kv('Pertama Daftar', _s(_bio, 'tgl_daftar')),
    ];
    final wide = MediaQuery.of(context).orientation == Orientation.landscape;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _card,
      child: wide
          ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Column(children: left)), const SizedBox(width: 24), Expanded(child: Column(children: right))])
          : Column(children: [...left, ...right]),
    );
  }

  Widget _buildKunjungan(Map<String, dynamic> k) {
    final noRawat = _s(k, 'no_rawat');
    final open = _expanded.contains(noRawat);
    final detail = _detail[noRawat];
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: _card,
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => _toggle(noRawat),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${_s(k, 'tgl_registrasi')} ${_s(k, 'jam_reg')}  ·  ${_s(k, 'nm_poli')}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                        const SizedBox(height: 2),
                        Text('$noRawat  ·  ${_s(k, 'nm_dokter')}  ·  ${_s(k, 'png_jawab')}', style: _kMuted),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(999)),
                    child: Text(_s(k, 'status_lanjut'), style: const TextStyle(fontSize: 11, color: _kGreen)),
                  ),
                  const SizedBox(width: 6),
                  Icon(open ? Icons.expand_less : Icons.expand_more, size: 20, color: const Color(0xFF6B7280)),
                ],
              ),
            ),
          ),
          if (open) ...[
            const Divider(height: 1, color: _kBorder),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _kv('No.Registrasi', _s(k, 'no_reg')),
                  ..._buildIcd('Diagnosa/Penyakit/ICD 10', _list(k, 'diagnosa_pasien'), 'kd_penyakit', 'nm_penyakit'),
                  ..._buildIcd('Prosedur Tindakan/ICD 9', _list(k, 'prosedur_pasien'), 'kode', 'deskripsi_panjang'),
                  if (detail == null)
                    const Padding(padding: EdgeInsets.all(16), child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))))
                  else
                    ..._buildDetail(k, detail),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _subTitle(String text) => Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 6),
        child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _kGreen)),
      );

  /// Tabel sederhana bergaris; [flex] per kolom.
  Widget _table(List<String> headers, List<int> flex, List<List<String>> rows) {
    return Table(
      border: TableBorder.all(color: _kBorder),
      columnWidths: {for (var i = 0; i < flex.length; i++) i: FlexColumnWidth(flex[i].toDouble())},
      children: [
        TableRow(
          decoration: const BoxDecoration(color: Color(0xFFF9FAFB)),
          children: [for (final h in headers) Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5), child: Text(h, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))))],
        ),
        for (final r in rows) TableRow(children: [for (final c in r) Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5), child: Text(c, style: _kText))]),
      ],
    );
  }

  List<Widget> _buildIcd(String title, List<Map<String, dynamic>> items, String kodeKey, String namaKey) {
    if (items.isEmpty) return [];
    return [
      _subTitle(title),
      _table(['Kode', title.startsWith('Diagnosa') ? 'Nama Penyakit' : 'Nama Prosedur', 'Prioritas'], [2, 8, 2], [for (final d in items) [_s(d, kodeKey), _s(d, namaKey), _s(d, 'prioritas')]]),
    ];
  }

  List<Widget> _buildDetail(Map<String, dynamic> k, RiwayatKunjunganDetail d) {
    final widgets = <Widget>[
      ..._buildPemeriksaan('Pemeriksaan Rawat Jalan', d.pemeriksaanRalan),
      ..._buildPemeriksaan('Pemeriksaan Rawat Inap', d.pemeriksaanRanap),
      ..._buildTindakan('Tindakan Rawat Jalan', d.tindakanRalan),
      ..._buildTindakan('Tindakan Rawat Inap', d.tindakanRanap),
      ..._buildObat(d.obat, _s(k, 'status_lanjut')),
      ..._buildRadiologi(d.radiologi),
      ..._buildLab(d.laboratorium),
    ];
    if (widgets.isEmpty) return [const Padding(padding: EdgeInsets.only(top: 10), child: Text('Tidak ada data pemeriksaan, tindakan, obat, radiologi, maupun laboratorium pada kunjungan ini.', style: _kMuted))];
    return widgets;
  }

  List<Widget> _buildPemeriksaan(String title, List<Map<String, dynamic>> list) {
    if (list.isEmpty) return [];
    Widget line(String label, String value) => Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [SizedBox(width: 72, child: Text(label, style: _kMuted)), const Text(':  ', style: _kMuted), Expanded(child: Text(value, style: _kText))],
          ),
        );
    return [
      _subTitle(title),
      for (var i = 0; i < list.length; i++)
        Builder(builder: (context) {
          final p = list[i];
          final vitals = [
            if (_s(p, 'suhu_tubuh').isNotEmpty) 'Suhu ${_s(p, 'suhu_tubuh')}°C',
            if (_s(p, 'tensi').isNotEmpty) 'Tensi ${_s(p, 'tensi')}',
            if (_s(p, 'nadi').isNotEmpty) 'Nadi ${_s(p, 'nadi')}/mnt',
            if (_s(p, 'respirasi').isNotEmpty) 'RR ${_s(p, 'respirasi')}/mnt',
            if (_s(p, 'tinggi').isNotEmpty) 'TB ${_s(p, 'tinggi')} cm',
            if (_s(p, 'berat').isNotEmpty) 'BB ${_s(p, 'berat')} kg',
            if (_s(p, 'spo2').isNotEmpty) 'SpO2 ${_s(p, 'spo2')}%',
            if (_s(p, 'gcs').isNotEmpty) 'GCS ${_s(p, 'gcs')}',
            if (_s(p, 'kesadaran').isNotEmpty) _s(p, 'kesadaran'),
            if (_s(p, 'lingkar_perut').isNotEmpty) 'L.P. ${_s(p, 'lingkar_perut')} cm',
          ].join('  ·  ');
          final jbtn = _s(p, 'jbtn');
          return Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFF9FAFB), borderRadius: BorderRadius.circular(4)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${i + 1}.  ${_s(p, 'tgl_perawatan')} ${_s(p, 'jam_rawat')}  ·  ${_s(p, 'nip')} ${_s(p, 'nama')}${jbtn.isEmpty || jbtn == '-' ? '' : ' ($jbtn)'}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                if (_s(p, 'keluhan').isNotEmpty) line('Subjek', _s(p, 'keluhan')),
                if (_s(p, 'pemeriksaan').isNotEmpty) line('Objek', _s(p, 'pemeriksaan')),
                if (vitals.isNotEmpty) line('Vital Sign', vitals),
                if (_s(p, 'alergi').isNotEmpty) line('Alergi', _s(p, 'alergi')),
                if (_s(p, 'penilaian').isNotEmpty) line('Asesmen', _s(p, 'penilaian')),
                if (_s(p, 'rtl').isNotEmpty) line('Plan', _s(p, 'rtl')),
                if (_s(p, 'instruksi').isNotEmpty) line('Inst/Impl', _s(p, 'instruksi')),
                if (_s(p, 'evaluasi').isNotEmpty) line('Evaluasi', _s(p, 'evaluasi')),
              ],
            ),
          );
        }),
    ];
  }

  /// Tanggal tindakan dokter datang ISO, kelompok lain DD/MM/YYYY.
  String _tgl(String tgl) {
    if (!tgl.contains('T')) return tgl;
    final parts = tgl.split('T').first.split('-');
    return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : tgl;
  }

  List<Widget> _buildTindakan(String title, Map<String, dynamic> data) {
    final dokter = _list(data, 'tindakan_dokter');
    final paramedis = _list(data, 'tindakan_paramedis');
    final keduanya = _list(data, 'tindakan_dokter_paramedis');
    if (dokter.isEmpty && paramedis.isEmpty && keduanya.isEmpty) return [];
    Widget sub(String label, List<Map<String, dynamic>> items, {required bool dr, required bool pr}) => Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(label, style: _kMuted)),
              _table(
                ['Tanggal', 'Kode', 'Nama Tindakan/Perawatan', if (dr) 'Dokter', if (pr) 'Perawat'],
                [3, 2, 5, if (dr) 3, if (pr) 3],
                [
                  for (final it in items) ['${_tgl(_s(it, 'tgl_perawatan'))} ${_s(it, 'jam_rawat')}', _s(it, 'kd_jenis_prw'), _s(it, 'nm_perawatan'), if (dr) _s(it, 'nm_dokter'), if (pr) _s(it, 'nama_paramedis')],
                ],
              ),
            ],
          ),
        );
    return [
      _subTitle(title),
      if (dokter.isNotEmpty) sub('Tindakan Dokter', dokter, dr: true, pr: false),
      if (paramedis.isNotEmpty) sub('Tindakan Perawat', paramedis, dr: false, pr: true),
      if (keduanya.isNotEmpty) sub('Tindakan Dokter & Perawat', keduanya, dr: true, pr: true),
    ];
  }

  /// Pemberian obat dikelompokkan per tanggal+jam (satu resep).
  List<Widget> _buildObat(Map<String, dynamic> data, String statusLanjut) {
    final list = _list(data, 'pemberian_obat');
    if (list.isEmpty) return [];
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final it in list) {
      groups.putIfAbsent('${_s(it, 'tgl_perawatan')} ${_s(it, 'jam')}', () => []).add(it);
    }
    return [
      _subTitle('Pemberian Obat'),
      for (final g in groups.entries)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text('${g.key}  ·  $statusLanjut', style: _kMuted)),
              _table(['Nama Obat', 'Jumlah'], [8, 2], [for (final it in g.value) [_s(it, 'nama_brng'), '${_s(it, 'jml')} ${_s(it, 'kode_sat')}'.trim()]]),
            ],
          ),
        ),
    ];
  }

  List<Widget> _buildRadiologi(Map<String, dynamic> data) {
    final pemeriksaan = _list(data, 'pemeriksaan');
    final hasil = _list(data, 'hasil');
    final gambar = _list(data, 'gambar');
    if (pemeriksaan.isEmpty && hasil.isEmpty && gambar.isEmpty) return [];
    return [
      _subTitle('Radiologi'),
      if (pemeriksaan.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: _table(
            ['Tanggal', 'Kode', 'Nama Pemeriksaan', 'Dokter PJ', 'Petugas'],
            [3, 2, 5, 3, 3],
            [
              for (final p in pemeriksaan) ['${_s(p, 'tgl_periksa')} ${_s(p, 'jam')}', _s(p, 'kd_jenis_prw'), '${_s(p, 'nm_perawatan')}${_s(p, 'proyeksi').isEmpty ? '' : '\n${_s(p, 'proyeksi')}'}', _s(p, 'nm_dokter'), _s(p, 'nama_petugas')],
            ],
          ),
        ),
      if (hasil.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: _table(['Tanggal', 'Bacaan/Hasil Radiologi'], [3, 13], [for (final h in hasil) ['${_s(h, 'tgl_periksa')} ${_s(h, 'jam')}', _s(h, 'hasil')]]),
        ),
      for (final g in gambar)
        if (_s(g, 'lokasi_gambar').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(bottom: 4), child: Text('Gambar Radiologi  ·  ${_s(g, 'tgl_periksa')} ${_s(g, 'jam')}', style: _kMuted)),
                Image.network('$kApiBaseUrl/radiologi/${_s(g, 'lokasi_gambar')}', height: 240, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Text('Gambar tidak dapat dimuat', style: _kMuted)),
              ],
            ),
          ),
    ];
  }

  List<Widget> _buildLab(Map<String, dynamic> data) {
    final groups = _list(data, 'lab_pkmb');
    final rows = <List<String>>[];
    for (final g in groups) {
      for (final item in _list(g, 'items')) {
        rows.add(['${_s(g, 'tgl_periksa')} ${_s(g, 'jam')}', _s(item, 'nm_perawatan'), '', '', '']);
        for (final d in _list(item, 'detail_items')) {
          rows.add(['', '   ${_s(d, 'pemeriksaan')}', '${_s(d, 'nilai')} ${_s(d, 'satuan')}'.trim(), _s(d, 'nilai_rujukan'), _s(d, 'keterangan')]);
        }
      }
    }
    if (rows.isEmpty) return [];
    return [_subTitle('Laboratorium'), _table(['Tanggal', 'Nama Tindakan', 'Hasil', 'Nilai Rujukan', 'Keterangan'], [3, 5, 3, 3, 2], rows)];
  }
}
