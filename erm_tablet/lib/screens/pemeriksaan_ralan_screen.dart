import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/app_user.dart';
import '../models/poli_patient.dart';
import '../models/ranap_patient.dart';
import '../models/soap_item.dart';
import '../services/api_client.dart';
import '../services/rawat_jalan_service.dart';
import '../services/soap_history_service.dart';
import '../services/soap_ralan_service.dart';
import 'diagnosa_tab.dart';
import 'lab_tab.dart';
import 'rad_tab.dart';
import 'resep_tab.dart';
import 'riwayat_perawatan_screen.dart';
import 'tindakan_tab.dart';

const _kBorder = Color(0xFFE5E7EB);
const _kGreen = Color(0xFF059669);

/// Enum Kesadaran PERSIS kolom pemeriksaan_ralan.kesadaran (KESADARAN_OPTIONS
/// di Pemeriksaan.tsx).
const _kKesadaran = [
  'Compos Mentis',
  'Apatis',
  'Somnolence',
  'Sopor',
  'Coma',
  'Alert',
  'Confusion',
  'Voice',
  'Pain',
  'Unresponsive',
  'Delirium',
  'Meninggal'
];

/// PemeriksaanRalanScreen — form Pemeriksaan Rawat Jalan fullscreen,
/// padanan Pemeriksaan.tsx (web): sidebar Informasi Pasien + tab SOAP/CPPT
/// (form, riwayat tersimpan dgn Edit/Copy/Hapus, card Riwayat Kunjungan
/// Terakhir). Dibuka dari PoliScreen saat nama pasien diketuk. Endpoint
/// SAMA PERSIS dgn web, tidak ada endpoint baru.
///
/// Tab lain memakai ulang widget tab Rawat Inap (riwayat saja, belum ada
/// input): LAB/RAD/DIAGNOSA apa adanya (endpoint generik per no_rawat),
/// RESEP/TINDAKAN lewat flag `ralan` (endpoint Rawat Jalan), USG = RadTab
/// dgn `kategoriUsg`. BELUM direplikasi dari web: tab Catatan Dokter &
/// Upload, tombol SOAPIE/Riwayat Perawatan/Rujuk/ICare, dan saran isian
/// dari riwayat ketikan (localStorage di web).
class PemeriksaanRalanScreen extends StatefulWidget {
  final AppUser user;
  final PoliPatient patient;
  const PemeriksaanRalanScreen(
      {super.key, required this.user, required this.patient});

  @override
  State<PemeriksaanRalanScreen> createState() => _PemeriksaanRalanScreenState();
}

class _PemeriksaanRalanScreenState extends State<PemeriksaanRalanScreen>
    with SingleTickerProviderStateMixin {
  // Tab USG dibatasi sama spt web (canAccessFeature('pemeriksaan-usg')):
  // admin selalu lihat, role lain wajib di-whitelist lewat allowed_modules.
  late final bool _canAccessUsg = widget.user.role == 'admin' ||
      widget.user.allowedModules.split(',').contains('pemeriksaan-usg');
  late final List<String> _tabs = [
    'SOAP/CPPT',
    'RESEP',
    if (_canAccessUsg) 'USG',
    'TINDAKAN',
    'LAB',
    'RAD',
    'DIAGNOSA'
  ];
  late final TabController _tabController =
      TabController(length: _tabs.length, vsync: this);
  final _resepOpenRequest = ResepOpenRequest();

  /// "Lanjut Input Resep" setelah simpan SOAP: pindah ke tab Resep &
  /// langsung buka modal Input Resep.
  void _lanjutInputResep() {
    _tabController.animateTo(_tabs.indexOf('RESEP'));
    _resepOpenRequest.request();
  }

  Map<String, dynamic> _pasien = {};

  // Tab2 pakai-ulang bertipe RanapPatient tapi cuma membaca noRawat (+
  // noRkmMedis utk Resep) — dibungkus di sini drpd mengubah tipenya.
  late final RanapPatient _asRanap = RanapPatient(
    noRawat: widget.patient.noRawat,
    noRkmMedis: widget.patient.noRkmMedis,
    nmPasien: widget.patient.nmPasien,
    umur: widget.patient.umur,
    jk: '',
    kamar: '',
    nmDokter: widget.patient.nmDokter,
    tglMasuk: '',
    jamMasuk: '',
    tglKeluar: '',
    sttsPulang: '-',
    lama: '',
    statusBayar: '',
    pngJawab: widget.patient.pngJawab,
    diagnosaAwal: '',
    alamat: '',
    tglLahir: '',
    pekerjaan: '',
  );

  @override
  void initState() {
    super.initState();
    _loadPasien();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _resepOpenRequest.dispose();
    super.dispose();
  }

  Future<void> _loadPasien() async {
    try {
      final data = await RawatJalanService.getPasien(widget.patient.noRkmMedis);
      if (mounted) setState(() => _pasien = data);
    } catch (_) {/* diam, sidebar tampil dgn data dari daftar poli saja */}
  }

  void _openInfoSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      constraints: const BoxConstraints(),
      builder: (context) => SizedBox(
          height: MediaQuery.of(context).size.height * 0.75,
          child: _PatientInfo(patient: widget.patient, pasien: _pasien)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final patient = widget.patient;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        bottom: false,
        child: Row(
          children: [
            if (isLandscape)
              Container(
                width: 250,
                decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(right: BorderSide(color: _kBorder))),
                child: _PatientInfo(patient: patient, pasien: _pasien),
              ),
            Expanded(
              child: Column(
                children: [
                  Container(
                    height: 52,
                    padding: const EdgeInsets.only(left: 4, right: 16),
                    decoration: const BoxDecoration(
                        color: Colors.white,
                        border: Border(bottom: BorderSide(color: _kBorder))),
                    child: Row(
                      children: [
                        IconButton(
                            icon: const Icon(Icons.arrow_back,
                                size: 20, color: Color(0xFF374151)),
                            tooltip: 'Kembali',
                            onPressed: () => Navigator.of(context).pop()),
                        Expanded(
                          child: Text(
                            isLandscape
                                ? 'Pemeriksaan'
                                : '${patient.nmPasien} · ${patient.noRkmMedis}',
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF374151)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isLandscape) ...[
                          const Icon(Icons.person_outline,
                              size: 16, color: Color(0xFF6B7280)),
                          const SizedBox(width: 6),
                          const Text('',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFF6B7280))),
                          Text(
                              patient.nmDokter.isEmpty ? '-' : patient.nmDokter,
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF374151))),
                        ] else
                          IconButton(
                              icon: const Icon(Icons.info_outline,
                                  size: 20, color: _kGreen),
                              tooltip: 'Informasi Pasien',
                              onPressed: _openInfoSheet),
                        const SizedBox(width: 12),
                        ElevatedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 10),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(4)),
                          ),
                          child: const Text('Selesai',
                              style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    color: Colors.white,
                    width: double.infinity,
                    child: TabBar(
                      controller: _tabController,
                      isScrollable: true,
                      tabAlignment: TabAlignment.start,
                      labelColor: _kGreen,
                      unselectedLabelColor: const Color(0xFF6B7280),
                      indicatorColor: _kGreen,
                      labelStyle: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600),
                      tabs: _tabs.map((t) => Tab(text: t)).toList(),
                    ),
                  ),
                  const Divider(height: 1, color: _kBorder),
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        // Status di sidebar ikut berubah jadi "Sudah" begitu
                        // SOAP tersimpan.
                        _SoapRalanTab(
                            patient: patient,
                            onStatusChanged: () => setState(() {}),
                            onLanjutResep: _lanjutInputResep),
                        ResepTab(
                            patient: _asRanap,
                            ralan: true,
                            kdDokter: patient.kdDokter,
                            openRequest: _resepOpenRequest),
                        if (_canAccessUsg)
                          RadTab(
                              patient: _asRanap,
                              flat: true, kategoriUsg: true,
                              kdDokter: patient.kdDokter,
                              nmDokter: patient.nmDokter,
                              userNip: widget.user.nip),
                        TindakanTab(
                            patient: _asRanap,
                            ralan: true,
                            kdDokter: patient.kdDokter,
                            kdPj: patient.kdPj,
                            userNip: widget.user.nip),
                        LabTab(patient: _asRanap, flat: true),
                        RadTab(patient: _asRanap, flat: true),
                        DiagnosaTab(patient: _asRanap, flat: true),
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

/// _PatientInfo — padanan sidebar "Informasi Pasien" Pemeriksaan.tsx:
/// header (cara bayar, nama, No. RM) + kartu identitas + kartu Registrasi.
/// [pasien] = data lengkap /api/pendaftaran/pasien (kosong selama dimuat).
class _PatientInfo extends StatelessWidget {
  final PoliPatient patient;
  final Map<String, dynamic> pasien;
  const _PatientInfo({required this.patient, required this.pasien});

  String _s(String key) => pasien[key] as String? ?? '';

  String get _ttl {
    final tmp = _s('tmp_lahir');
    // Ambil 10 karakter pertama (YYYY-MM-DD) — tgl_lahir ISO ber-offset
    // +07:00, kalau di-parse utuh tanggalnya bisa mundur sehari (UTC).
    final raw = _s('tgl_lahir');
    final tgl =
        raw.length >= 10 ? DateTime.tryParse(raw.substring(0, 10)) : null;
    final tglText =
        tgl == null ? '-' : DateFormat('d MMMM yyyy', 'id_ID').format(tgl);
    final umur = _s('umur').isNotEmpty ? _s('umur') : patient.umur;
    return '${tmp.isEmpty ? '' : '$tmp, '}$tglText${umur.isEmpty ? '' : ' ($umur)'}';
  }

  @override
  Widget build(BuildContext context) {
    final jk = _s('jk');
    final sudah = patient.stts == 'Sudah';
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 20),
          color: _kGreen,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                      child: Text('Informasi Pasien',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Colors.white))),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12)),
                    child: Text(
                        patient.pngJawab.isEmpty ? 'UMUM' : patient.pngJawab,
                        style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: _kGreen)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                        color: Colors.white24,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white38, width: 2)),
                    child:
                        const Icon(Icons.person, size: 30, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(patient.nmPasien.isEmpty ? '-' : patient.nmPasien,
                            style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Colors.white)),
                        const SizedBox(height: 2),
                        Text(patient.noRkmMedis,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Colors.white)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              _card([
                _info(
                    Icons.wc,
                    'Jenis Kelamin',
                    jk == 'L'
                        ? 'Laki-laki'
                        : (jk == 'P' ? 'Perempuan' : (jk.isEmpty ? '-' : jk))),
                _info(Icons.cake_outlined, 'Tempat, Tanggal Lahir', _ttl),
                _info(Icons.bloodtype_outlined, 'Golongan Darah',
                    _s('gol_darah')),
                _info(Icons.place_outlined, 'Alamat', _s('alamat')),
                _info(Icons.school_outlined, 'Pendidikan', _s('pnd')),
                _info(Icons.person_outline, 'Nama Ibu Kandung', _s('nm_ibu')),
              ]),
              const SizedBox(height: 12),
              _card([
                const Text('Registrasi',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF111827))),
                _info(Icons.tag, 'No. Rawat', patient.noRawat),
                _info(Icons.schedule, 'Tanggal & Jam',
                    '${patient.tglRegistrasi} | ${patient.jamReg}'),
                _info(Icons.local_hospital_outlined, 'Poliklinik',
                    patient.nmPoli),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: sudah
                        ? const Color(0xFFD1FAE5)
                        : const Color(0xFFFEE2E2),
                    border: Border.all(
                        color: sudah
                            ? const Color(0xFFA7F3D0)
                            : const Color(0xFFFECACA)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                          sudah
                              ? Icons.check_circle_outline
                              : Icons.radio_button_unchecked,
                          size: 16,
                          color: sudah ? _kGreen : const Color(0xFFDC2626)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Status Pemeriksaan',
                                style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: sudah
                                        ? const Color(0xFF065F46)
                                        : const Color(0xFF991B1B))),
                            Text(
                              sudah
                                  ? 'Sudah Periksa'
                                  : (patient.stts == 'Belum' ||
                                          patient.stts.isEmpty
                                      ? 'Belum Periksa'
                                      : patient.stts),
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: sudah
                                      ? _kGreen
                                      : const Color(0xFFDC2626)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ]),
            ],
          ),
        ),
      ],
    );
  }

  Widget _card(List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            children[i]
          ],
        ],
      ),
    );
  }

  Widget _info(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(icon, size: 14, color: const Color(0xFF6B7280))),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label.toUpperCase(),
                  style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.5,
                      color: Color(0xFF6B7280))),
              const SizedBox(height: 2),
              Text(value.isEmpty ? '-' : value,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF111827))),
            ],
          ),
        ),
      ],
    );
  }
}

/// _SoapRalanTab — tab SOAP/CPPT: form input (kiri S/O + Vital Sign, kanan
/// A/P/I/E di landscape; satu kolom di portrait), riwayat tersimpan
/// kunjungan ini, dan card Riwayat Kunjungan Terakhir.
class _SoapRalanTab extends StatefulWidget {
  final PoliPatient patient;
  final VoidCallback onStatusChanged;
  final VoidCallback onLanjutResep;
  const _SoapRalanTab(
      {required this.patient,
      required this.onStatusChanged,
      required this.onLanjutResep});

  @override
  State<_SoapRalanTab> createState() => _SoapRalanTabState();
}

class _SoapRalanTabState extends State<_SoapRalanTab>
    with AutomaticKeepAliveClientMixin {
  final _subjective = TextEditingController();
  final _objective = TextEditingController();
  final _assessment = TextEditingController();
  final _planning = TextEditingController();
  final _instruksi = TextEditingController();
  final _evaluasi = TextEditingController();
  final _suhu = TextEditingController();
  final _tensi = TextEditingController();
  final _berat = TextEditingController();
  final _tinggi = TextEditingController();
  final _nadi = TextEditingController();
  final _respirasi = TextEditingController();
  final _spo2 = TextEditingController();
  final _lingkarPerut = TextEditingController();
  final _gcs = TextEditingController();
  final _alergi = TextEditingController();
  String _kesadaran = _kKesadaran.first;
  final _scroll = ScrollController();

  List<TextEditingController> get _allCtrl => [
        _subjective,
        _objective,
        _assessment,
        _planning,
        _instruksi,
        _evaluasi,
        _suhu,
        _tensi,
        _berat,
        _tinggi,
        _nadi,
        _respirasi,
        _spo2,
        _lingkarPerut,
        _gcs,
        _alergi
      ];

  // Saran isian (autocomplete) dari riwayat ketikan di perangkat ini —
  // kolom & nama kuncinya sama dgn web (lihat SoapHistoryService).
  late final Map<String, TextEditingController> _historyCtrl = {
    'subjective_history': _subjective,
    'objective_history': _objective,
    'assessment_history': _assessment,
    'planning_history': _planning,
    'instruksi_history': _instruksi,
    'evaluasi_history': _evaluasi,
    'tensi_history': _tensi,
    'suhu_history': _suhu,
    'nadi_history': _nadi,
    'respirasi_history': _respirasi,
    'tinggi_history': _tinggi,
    'berat_history': _berat,
  };
  late final Map<String, FocusNode> _historyFocus = {
    for (final k in _historyCtrl.keys) k: FocusNode()
  };
  Map<String, List<String>> _history = {};

  bool _saving = false;
  String? _formError;
  // Baris riwayat yg sedang diedit — null = mode input baru.
  SoapItem? _editing;

  bool _loadingRiwayat = true;
  String? _riwayatError;
  List<SoapItem> _riwayat = [];

  bool _loadingLast = true;
  SoapItem? _lastSoapie;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadRiwayat();
    _loadLastSoapie();
    SoapHistoryService.loadAll(_historyCtrl.keys).then((h) {
      if (mounted) setState(() => _history = h);
    });
  }

  /// Simpan isian form yg baru tersimpan ke riwayat saran tiap kolom.
  Future<void> _saveHistory() async {
    final values = {for (final e in _historyCtrl.entries) e.key: e.value.text};
    final next = Map<String, List<String>>.from(_history);
    for (final e in values.entries) {
      next[e.key] =
          await SoapHistoryService.add(e.key, e.value, next[e.key] ?? const []);
    }
    if (mounted) setState(() => _history = next);
  }

  @override
  void dispose() {
    for (final c in _allCtrl) {
      c.dispose();
    }
    for (final f in _historyFocus.values) {
      f.dispose();
    }
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadRiwayat() async {
    try {
      final list = await SoapRalanService.getRiwayat(widget.patient.noRawat);
      if (!mounted) return;
      setState(() {
        _riwayat = list;
        _riwayatError = null;
        _loadingRiwayat = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _riwayatError = 'Gagal mengambil riwayat SOAP/CPPT';
        _loadingRiwayat = false;
      });
    }
  }

  Future<void> _loadLastSoapie() async {
    SoapItem? last;
    try {
      last = await SoapRalanService.getLastSoapie(widget.patient.noRkmMedis);
    } catch (_) {/* diam, card tampil "Belum ada riwayat SOAPIE" */}
    if (!mounted) return;
    setState(() {
      _lastSoapie = last;
      _loadingLast = false;
    });
  }

  void _toast(String message, {bool error = false}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
          content: Text(message),
          backgroundColor:
              error ? const Color(0xFFDC2626) : const Color(0xFF16A34A)));
  }

  void _clearForm() {
    setState(() {
      for (final c in _allCtrl) {
        c.clear();
      }
      _kesadaran = _kKesadaran.first;
      _editing = null;
      _formError = null;
    });
  }

  /// [excludePlanning] — khusus Copy dari card Riwayat Kunjungan Terakhir
  /// (Planning kunjungan lalu tidak relevan, harus diisi ulang dokter).
  void _fillForm(SoapItem item, {bool excludePlanning = false}) {
    _subjective.text = item.keluhan;
    _objective.text = item.pemeriksaan;
    _assessment.text = item.penilaian;
    _planning.text = excludePlanning ? '' : item.rtl;
    _instruksi.text = item.instruksi;
    _evaluasi.text = item.evaluasi;
    _suhu.text = item.suhuTubuh;
    _tensi.text = item.tensi;
    _berat.text = item.berat;
    _tinggi.text = item.tinggi;
    _nadi.text = item.nadi;
    _respirasi.text = item.respirasi;
    _spo2.text = item.spo2;
    _lingkarPerut.text = item.lingkarPerut;
    _gcs.text = item.gcs;
    _alergi.text = item.alergi;
    _kesadaran = _kKesadaran.contains(item.kesadaran)
        ? item.kesadaran
        : _kKesadaran.first;
    if (_scroll.hasClients)
      _scroll.animateTo(0,
          duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  }

  void _edit(SoapItem item) {
    setState(() {
      _fillForm(item);
      _editing = item;
      _formError = null;
    });
  }

  void _copy(SoapItem item, {bool excludePlanning = false}) {
    setState(() {
      _fillForm(item, excludePlanning: excludePlanning);
      _editing = null;
      _formError = null;
    });
    _toast('Data SOAPIE berhasil di-copy ke form pemeriksaan');
  }

  /// Jam selalu HH:MM:SS (padanan normalisasi di Pemeriksaan.tsx).
  String _jam(String jam) =>
      jam.length == 5 ? '$jam:00' : (jam.isEmpty ? '00:00:00' : jam);

  Future<void> _submit() async {
    final patient = widget.patient;
    if (_subjective.text.trim().isEmpty ||
        _objective.text.trim().isEmpty ||
        _assessment.text.trim().isEmpty) {
      setState(
          () => _formError = 'Subjective, Objective, dan Asesmen wajib diisi.');
      return;
    }
    final editing = _editing;
    final now = DateTime.now();
    setState(() {
      _saving = true;
      _formError = null;
    });
    try {
      await SoapRalanService.simpan({
        'no_rawat': patient.noRawat,
        // Mode edit: tgl/jam milik baris yg diedit (kunci data), bukan
        // waktu sekarang.
        'tgl_perawatan': editing != null
            ? soapDateToApi(editing.tglPerawatan)
            : DateFormat('yyyy-MM-dd').format(now),
        'jam_rawat': editing != null
            ? _jam(editing.jamRawat)
            : DateFormat('HH:mm:ss').format(now),
        'suhu_tubuh': _suhu.text.trim(),
        'tensi': _tensi.text.trim(),
        'nadi': _nadi.text.trim(),
        'respirasi': _respirasi.text.trim(),
        'tinggi': _tinggi.text.trim(),
        'berat': _berat.text.trim(),
        'spo2': _spo2.text.trim(),
        'gcs': _gcs.text.trim(),
        'kesadaran': _kesadaran,
        'keluhan': _subjective.text.trim(),
        'pemeriksaan': _objective.text.trim(),
        'alergi': _alergi.text.trim(),
        'lingkar_perut': _lingkarPerut.text.trim(),
        'rtl': _planning.text.trim(),
        'penilaian': _assessment.text.trim(),
        'instruksi': _instruksi.text.trim(),
        'evaluasi': _evaluasi.text.trim(),
        // Sama dgn web: NIP pencatat = kd_dokter kunjungan ini, bukan akun
        // yg login.
        'nip': patient.kdDokter,
      }, edit: editing != null);

      // Status pasien jadi "Sudah" setelah SOAP tersimpan — kalau gagal,
      // SOAP-nya tetap tersimpan (sama dgn web).
      try {
        await SoapRalanService.setSudahPeriksa(patient.noRawat);
        patient.stts = 'Sudah';
        widget.onStatusChanged();
      } catch (_) {/* diam */}

      if (!mounted) return;
      // Tanpa await: nilai kolom sudah disalin sebelum form dikosongkan.
      _saveHistory();
      _clearForm();
      _loadRiwayat();
      // Sama dgn web: setelah SOAP tersimpan, tawarkan lanjut ke Input Resep.
      final lanjut = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          icon:
              const Icon(Icons.check_circle_outline, size: 48, color: _kGreen),
          title: const Text('Berhasil!',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          content: Text(
              editing != null
                  ? 'SOAP berhasil diupdate!'
                  : 'SOAP berhasil disimpan!',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13)),
          actionsAlignment: MainAxisAlignment.center,
          actions: [
            SizedBox(
              width: 260,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(true),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: _kGreen,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(2)),
                        padding: const EdgeInsets.symmetric(vertical: 12)),
                    child: const Text('Lanjut Input Resep',
                        style: TextStyle(fontSize: 13)),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6B7280),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(2)),
                        padding: const EdgeInsets.symmetric(vertical: 12)),
                    child: const Text('Tidak, tutup',
                        style: TextStyle(fontSize: 13)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
      if (lanjut == true && mounted) widget.onLanjutResep();
    } catch (e) {
      if (!mounted) return;
      setState(() => _formError = e is ApiException
          ? e.message
          : 'Terjadi kesalahan saat menyimpan SOAP');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(SoapItem item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Yakin ingin menghapus?'),
        content: const Text('Data SOAP ini akan dihapus secara permanen'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Batal')),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Ya, Hapus!',
                  style: TextStyle(color: Color(0xFFDC2626)))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await SoapRalanService.hapus(
          noRawat: widget.patient.noRawat,
          tglPerawatan: soapDateToApi(item.tglPerawatan),
          jamRawat: _jam(item.jamRawat));
      if (!mounted) return;
      if (identical(_editing, item)) _clearForm();
      _toast('SOAP berhasil dihapus!');
      await _loadRiwayat();
    } catch (e) {
      if (!mounted) return;
      _toast(e is ApiException ? e.message : 'Gagal menghapus SOAP',
          error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;
    final main = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_editing != null) ...[_editBanner(), const SizedBox(height: 12)],
        _buildForm(isLandscape),
        if (!isLandscape) ...[const SizedBox(height: 16), _buildLastSoapie()],
        const SizedBox(height: 16),
        _buildRiwayat(),
      ],
    );
    return SingleChildScrollView(
      controller: _scroll,
      padding: const EdgeInsets.all(16),
      // Landscape: 70% form+riwayat, 30% card Riwayat Kunjungan Terakhir
      // (sama pembagian dgn web).
      child: isLandscape
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 7, child: main),
                const SizedBox(width: 16),
                Expanded(flex: 3, child: _buildLastSoapie()),
              ],
            )
          : main,
    );
  }

  Widget _editBanner() {
    final e = _editing!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          border: Border.all(color: _kGreen),
          borderRadius: BorderRadius.circular(4)),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Mode Edit — mengubah data SOAP/CPPT tanggal ${e.tglPerawatan} ${e.jamRawat}. Tanggal/Jam dikunci karena jadi kunci data.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF065F46)),
            ),
          ),
          const SizedBox(width: 12),
          OutlinedButton(
            onPressed: _clearForm,
            style: OutlinedButton.styleFrom(
                side: const BorderSide(color: _kGreen),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(4)),
                minimumSize: Size.zero,
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
            child: const Text('Batal Edit',
                style: TextStyle(fontSize: 12, color: Color(0xFF065F46))),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(bool isLandscape) {
    final kiri = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _field('Subjective', _subjective,
            history: 'subjective_history',
            required: true,
            lines: 3,
            maxLength: 2000,
            hint: 'Keluhan yang disampaikan pasien...'),
        const SizedBox(height: 10),
        _field('Objective', _objective,
            history: 'objective_history',
            required: true,
            lines: 3,
            maxLength: 2000,
            hint: 'Hasil pemeriksaan fisik...'),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
                child: _field('Suhu', _suhu,
                    history: 'suhu_history', maxLength: 5)),
            const SizedBox(width: 8),
            Expanded(
                child: _field('Tensi', _tensi,
                    history: 'tensi_history', maxLength: 8, hint: '120/80')),
            const SizedBox(width: 8),
            Expanded(
                child: _field('BB (Kg)', _berat,
                    history: 'berat_history', maxLength: 5)),
            const SizedBox(width: 8),
            Expanded(
                child: _field('TB (cm)', _tinggi,
                    history: 'tinggi_history', maxLength: 5)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
                child: _field('Nadi', _nadi,
                    history: 'nadi_history', maxLength: 3)),
            const SizedBox(width: 8),
            Expanded(
                child: _field('Respirasi', _respirasi,
                    history: 'respirasi_history', maxLength: 3)),
            const SizedBox(width: 8),
            Expanded(child: _field('SpO2', _spo2, maxLength: 3)),
            const SizedBox(width: 8),
            Expanded(child: _field('L.P. (cm)', _lingkarPerut, maxLength: 5)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
                flex: 2, child: _field('GCS (E,V,M)', _gcs, maxLength: 10)),
            const SizedBox(width: 8),
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _label('Kesadaran'),
                  DropdownButtonFormField<String>(
                    value: _kesadaran,
                    isExpanded: true,
                    decoration: const InputDecoration(
                        isDense: true,
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                    style:
                        const TextStyle(fontSize: 13, color: Color(0xFF111827)),
                    items: _kKesadaran
                        .map((k) => DropdownMenuItem(
                            value: k,
                            child: Text(k, overflow: TextOverflow.ellipsis)))
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _kesadaran = v ?? _kesadaran),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(flex: 3, child: _field('Alergi', _alergi, maxLength: 80)),
          ],
        ),
      ],
    );
    final kanan = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _field('Asesmen', _assessment,
            history: 'assessment_history',
            required: true,
            lines: 3,
            maxLength: 2000,
            hint: 'Diagnosis atau assessment...'),
        const SizedBox(height: 10),
        _field('Planning', _planning,
            history: 'planning_history',
            lines: 3,
            maxLength: 2000,
            hint: 'Rencana tindak lanjut...'),
        const SizedBox(height: 10),
        _field('Instruksi/Implementasi', _instruksi,
            history: 'instruksi_history', lines: 3, maxLength: 2000),
        const SizedBox(height: 10),
        _field('Evaluasi', _evaluasi,
            history: 'evaluasi_history', lines: 2, maxLength: 2000),
      ],
    );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isLandscape)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: kiri),
                const SizedBox(width: 20),
                Expanded(child: kanan)
              ],
            )
          else ...[kiri, const SizedBox(height: 10), kanan],
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _actionBtn(
                  _saving
                      ? 'Menyimpan...'
                      : (_editing != null ? 'Update SOAP' : 'Simpan SOAP/CPPT'),
                  _kGreen,
                  _saving ? null : _submit),
              _actionBtn('Clear', const Color(0xFF6B7280), _clearForm),
              _actionBtn(
                'Riwayat Perawatan',
                const Color(0xFF6B7280),
                () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => RiwayatPerawatanScreen(
                        noRkmMedis: widget.patient.noRkmMedis,
                        nmPasien: widget.patient.nmPasien))),
              ),
              _actionBtn('Selesai', const Color(0xFF2563EB),
                  () => Navigator.of(context).pop()),
            ],
          ),
          if (_formError != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                  borderRadius: BorderRadius.circular(4)),
              child: Text(_formError!,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF991B1B))),
            ),
          ],
        ],
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback? onPressed) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }

  Widget _label(String text, {bool required = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text.rich(
        TextSpan(text: text, children: [
          if (required)
            const TextSpan(
                text: ' *', style: TextStyle(color: Color(0xFFEF4444)))
        ]),
        style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  /// [history] = kunci riwayat saran kolom ini; diisi -> kolom jadi
  /// autocomplete: begitu difokuskan muncul isian terakhir, lalu menyempit
  /// mengikuti ketikan. Ketuk saran utk langsung mengisi kolomnya.
  Widget _field(String label, TextEditingController ctrl,
      {bool required = false,
      int lines = 1,
      int? maxLength,
      String? hint,
      String? history}) {
    Widget input(TextEditingController c, FocusNode? focus) => TextField(
          controller: c,
          focusNode: focus,
          minLines: lines,
          maxLines: lines == 1 ? 1 : lines + 2,
          maxLength: maxLength,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
            isDense: true,
            counterText: '',
            border: const OutlineInputBorder(),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(label, required: required),
        if (history == null)
          input(ctrl, null)
        else
          LayoutBuilder(
            builder: (context, constraints) => RawAutocomplete<String>(
              textEditingController: ctrl,
              focusNode: _historyFocus[history],
              optionsBuilder: (value) => SoapHistoryService.suggest(
                  _history[history] ?? const [], value.text),
              fieldViewBuilder: (context, c, focus, _) => input(c, focus),
              optionsViewBuilder: (context, onSelected, options) => Align(
                alignment: Alignment.topLeft,
                child: Material(
                  elevation: 4,
                  borderRadius: BorderRadius.circular(4),
                  clipBehavior: Clip.antiAlias,
                  child: ConstrainedBox(
                    // Selebar kolomnya; kolom vital sign yg sempit diberi
                    // lebar minimum spy sarannya tetap terbaca.
                    constraints: BoxConstraints(
                        maxHeight: 200,
                        maxWidth: constraints.maxWidth < 140
                            ? 140
                            : constraints.maxWidth),
                    child: ListView.separated(
                      padding: EdgeInsets.zero,
                      shrinkWrap: true,
                      itemCount: options.length,
                      separatorBuilder: (_, __) =>
                          const Divider(height: 1, color: _kBorder),
                      itemBuilder: (context, i) {
                        final option = options.elementAt(i);
                        return InkWell(
                          onTap: () => onSelected(option),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            child: Text(option,
                                style: const TextStyle(
                                    fontSize: 12, color: Color(0xFF111827)),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis),
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildRiwayat() {
    Widget empty(String text,
            {Color color = const Color(0xFF9CA3AF)}) =>
        Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
                child:
                    Text(text, style: TextStyle(fontSize: 12, color: color))));
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Riwayat SOAP/CPPT',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (_loadingRiwayat)
            empty('Memuat...')
          else if (_riwayatError != null)
            empty(_riwayatError!, color: const Color(0xFFDC2626))
          else if (_riwayat.isEmpty)
            empty(
                'Belum ada data SOAP/CPPT — catatan perkembangan pasien ini belum tersimpan.')
          else
            ..._riwayat.map((s) => _RiwayatCard(
                item: s,
                editing: identical(_editing, s),
                onEdit: () => _edit(s),
                onCopy: () => _copy(s),
                onDelete: () => _delete(s))),
        ],
      ),
    );
  }

  Widget _buildLastSoapie() {
    final last = _lastSoapie;
    final box = BoxDecoration(
        color: Colors.white,
        border: Border.all(color: _kBorder),
        borderRadius: BorderRadius.circular(4));
    if (_loadingLast || last == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
        decoration: box,
        child: Text(_loadingLast ? 'Memuat...' : 'Belum ada riwayat SOAPIE',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
      );
    }
    final tgl = soapDateToApi(last.tglPerawatan).split('-').reversed.join('/');
    Widget section(String label, String value) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style:
                      const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
              const SizedBox(height: 2),
              Text(value.isEmpty ? '-' : value,
                  style: const TextStyle(
                      fontSize: 12, height: 1.5, color: Color(0xFF111827))),
            ],
          ),
        );
    Widget vital(String label, String value, String unit) => Expanded(
          child: Text.rich(
            TextSpan(
                text: '$label: ',
                style: const TextStyle(color: Color(0xFF9CA3AF)),
                children: [
                  TextSpan(
                      text: '${value.isEmpty ? '-' : value}$unit',
                      style: const TextStyle(color: Color(0xFF374151)))
                ]),
            style: const TextStyle(fontSize: 11),
          ),
        );
    return Container(
      decoration: box,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
            decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: _kBorder))),
            child: Row(
              children: [
                const Expanded(
                    child: Text('Riwayat Kunjungan Terakhir',
                        style:
                            TextStyle(fontSize: 12, color: Color(0xFF111827)))),
                ElevatedButton(
                  onPressed: () => _copy(last, excludePlanning: true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kGreen,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    minimumSize: Size.zero,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(4)),
                  ),
                  child: const Text('Copy', style: TextStyle(fontSize: 11)),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$tgl ${_jam(last.jamRawat)}',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF6B7280))),
                const SizedBox(height: 10),
                section('Keluhan', last.keluhan),
                section('Pemeriksaan', last.pemeriksaan),
                section('Asesmen', last.penilaian),
                section('Planning', last.rtl),
                if (last.instruksi.isNotEmpty)
                  section('Instruksi/Implementasi', last.instruksi),
                if (last.evaluasi.isNotEmpty)
                  section('Evaluasi', last.evaluasi),
                const Divider(height: 1, color: _kBorder),
                const SizedBox(height: 10),
                Row(children: [
                  vital('TD', last.tensi, ''),
                  vital('Suhu', last.suhuTubuh, '°C')
                ]),
                const SizedBox(height: 6),
                Row(children: [
                  vital('Nadi', last.nadi, '/mnt'),
                  vital('RR', last.respirasi, '/mnt')
                ]),
                const SizedBox(height: 6),
                Row(children: [
                  vital('TB', last.tinggi, ' cm'),
                  vital('BB', last.berat, ' kg')
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Satu baris riwayat SOAP/CPPT kunjungan ini + aksi Edit/Copy/Hapus
/// (padanan baris renderSoapCpptTable di web, disajikan sbg kartu).
class _RiwayatCard extends StatelessWidget {
  final SoapItem item;
  final bool editing;
  final VoidCallback onEdit;
  final VoidCallback onCopy;
  final VoidCallback onDelete;
  const _RiwayatCard(
      {required this.item,
      required this.editing,
      required this.onEdit,
      required this.onCopy,
      required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final vitals = [
      if (item.tensi.isNotEmpty) 'TD ${item.tensi}',
      if (item.suhuTubuh.isNotEmpty) 'Suhu ${item.suhuTubuh}°C',
      if (item.nadi.isNotEmpty) 'Nadi ${item.nadi}/mnt',
      if (item.respirasi.isNotEmpty) 'RR ${item.respirasi}/mnt',
      if (item.spo2.isNotEmpty) 'SpO2 ${item.spo2}%',
      if (item.berat.isNotEmpty) 'BB ${item.berat} kg',
      if (item.tinggi.isNotEmpty) 'TB ${item.tinggi} cm',
      if (item.lingkarPerut.isNotEmpty) 'LP ${item.lingkarPerut} cm',
      if (item.gcs.isNotEmpty) 'GCS ${item.gcs}',
      if (item.kesadaran.isNotEmpty) item.kesadaran,
      if (item.alergi.isNotEmpty) 'Alergi: ${item.alergi}',
    ].join(' · ');
    Widget line(String code, String value) => Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text.rich(
            TextSpan(
                text: '$code: ',
                style: const TextStyle(fontWeight: FontWeight.w700),
                children: [
                  TextSpan(
                      text: value.isEmpty ? '-' : value,
                      style: const TextStyle(fontWeight: FontWeight.w400))
                ]),
            style: const TextStyle(fontSize: 12, color: Color(0xFF111827)),
          ),
        );
    Widget action(
            String label, IconData icon, Color color, VoidCallback onPressed) =>
        TextButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: 14, color: color),
          label: Text(label, style: TextStyle(fontSize: 12, color: color)),
          style: TextButton.styleFrom(
              minimumSize: Size.zero,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: editing ? const Color(0xFFECFDF5) : const Color(0xFFF9FAFB),
        border: Border.all(color: editing ? _kGreen : Colors.transparent),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${item.tglPerawatan} ${item.jamRawat} · ${item.nama}${item.jbtn.isEmpty || item.jbtn == '-' ? '' : ' (${item.jbtn})'}',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF374151)),
                ),
              ),
              action(
                  'Edit', Icons.edit_outlined, const Color(0xFF2563EB), onEdit),
              action(
                  'Copy', Icons.copy_outlined, const Color(0xFF6B7280), onCopy),
              action('Hapus', Icons.delete_outline, const Color(0xFFDC2626),
                  onDelete),
            ],
          ),
          if (vitals.isNotEmpty)
            Padding(
                padding: const EdgeInsets.only(top: 2, bottom: 2),
                child: Text(vitals,
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF6B7280)))),
          line('S', item.keluhan),
          line('O', item.pemeriksaan),
          line('A', item.penilaian),
          line('P', item.rtl),
          if (item.instruksi.isNotEmpty) line('I', item.instruksi),
          if (item.evaluasi.isNotEmpty) line('E', item.evaluasi),
        ],
      ),
    );
  }
}
