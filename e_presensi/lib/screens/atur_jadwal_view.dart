import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../models/jadwal_pegawai_row.dart';
import '../models/jam_masuk_opsi.dart';
import '../services/api_client.dart';
import '../services/jadwal_pegawai_service.dart';
import '../widgets/tanggal_picker_modal.dart';

const _kGreenDark = Color(0xFF059669);
const _kBlue = Color(0xFF2563EB);
const _kBorder = Color(0xFFE5E7EB);

const _kHariOpsi = [
  (iso: 1, label: 'Sen'),
  (iso: 2, label: 'Sel'),
  (iso: 3, label: 'Rab'),
  (iso: 4, label: 'Kam'),
  (iso: 5, label: 'Jum'),
  (iso: 6, label: 'Sab'),
  (iso: 7, label: 'Min'),
];

const _kBulanIndo = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/// Padanan fitur "Jadwal Tetap" (bulk-assign) di JadwalPegawai.tsx (versi
/// web, admin desktop) — pilih departemen, centang pegawai, pilih shift +
/// hari berlaku (berulang tiap minggu, BUKAN tanggal kalender spesifik —
/// jadwal shift beda per kelompok pegawai diatur dgn mengulang alur ini
/// per kelompok, mis. 4 orang Shift Pagi lalu 2 orang lain Shift Malam).
class AturJadwalView extends StatefulWidget {
  final AppUser user;
  const AturJadwalView({super.key, required this.user});

  @override
  State<AturJadwalView> createState() => _AturJadwalViewState();
}

class _AturJadwalViewState extends State<AturJadwalView> {
  bool get _isAdmin => widget.user.role == 'admin';

  List<({String kode, String nama})> _departemenList = [];
  String? _departemen;

  List<JamMasukOpsi> _shiftList = [];
  String? _shift;

  bool _loadingPegawai = true;
  List<JadwalPegawaiRow> _pegawaiList = [];
  final Set<int> _selectedIds = {};

  Set<int> _hariAktif = {1, 2, 3, 4, 5, 6, 7};
  Set<int> _selectedTanggal = {};

  bool _saving = false;

  int _tahun = DateTime.now().year;
  int _bulan = DateTime.now().month;

  /// Shift "Reguler" (08:00-17:00) pakai jadwal berulang per hari (spt
  /// biasa); shift lain (rotasi/malam/dll) pakai tanggal kalender
  /// spesifik — krn shift rotasi biasanya beda2 tiap orang tiap tanggal,
  /// bukan pola mingguan tetap.
  bool get _isReguler =>
      _shift != null && _shift!.trim().toLowerCase() == 'reguler';

  @override
  void initState() {
    super.initState();
    _initPegawai();
  }

  Future<void> _initPegawai() async {
    // Tunggu _loadOpsi (isi _departemenList) SEBELUM set _departemen non-
    // admin — kalau _departemen di-set duluan sementara _departemenList
    // masih kosong, DropdownButton bisa assert-error krn value-nya gak
    // cocok item manapun.
    await Future.wait([_loadOpsi(), _loadPegawai()]);
    if (!mounted || _isAdmin) return;
    JadwalPegawaiRow? diriSendiri;
    for (final p in _pegawaiList) {
      if (p.nik == widget.user.nik) {
        diriSendiri = p;
        break;
      }
    }
    // Cuma auto-isi departemen sesuai profil pegawai yg login — dropdown
    // TETAP bisa diganti (mis. kepala bagian yg juga bantu atur jadwal
    // departemen lain), bukan dikunci.
    if (diriSendiri != null &&
        diriSendiri.departemen.isNotEmpty &&
        diriSendiri.departemen != '-') {
      setState(() => _departemen = diriSendiri!.departemen);
      await _loadPegawai();
    }
  }

  Future<void> _loadOpsi() async {
    try {
      final departemen =
          await ApiClient.getJsonArray('/api/pegawai/departemen');
      final shift = await JadwalPegawaiService.getJamMasukOpsi();
      if (!mounted) return;
      setState(() {
        _departemenList = departemen
            .map((d) => (
                  kode: d['kode'] as String? ?? '',
                  nama: d['nama'] as String? ?? ''
                ))
            .toList();
        _shiftList = shift;
      });
    } catch (_) {
      // Opsional — dropdown cuma kosong kalau gagal diambil.
    }
  }

  Future<void> _loadPegawai() async {
    setState(() => _loadingPegawai = true);
    try {
      final list = await JadwalPegawaiService.getList(
          tahun: _tahun, bulan: _bulan, departemen: _departemen);
      if (!mounted) return;
      setState(() {
        _pegawaiList = list;
        _selectedIds.removeWhere((id) => !list.any((p) => p.id == id));
        _loadingPegawai = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _pegawaiList = [];
        _loadingPegawai = false;
      });
    }
  }

  // Pindah bulan (mis. atur jadwal utk bulan depan) — reset tanggal
  // yg baru dipilih & belum disimpan (spesifik ke bulan yg lama, gak
  // relevan lagi), lalu muat ulang grid h1..h31 utk bulan yg baru.
  // Pegawai yg dicentang & hari aktif (Reguler) TETAP, krn keduanya
  // gak terikat bulan tertentu.
  void _gantiBulan(int delta) {
    setState(() {
      var m = _bulan + delta;
      var y = _tahun;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      _bulan = m;
      _tahun = y;
      _selectedTanggal = {};
    });
    _loadPegawai();
  }

  void _toggleSelectAll() {
    setState(() {
      if (_selectedIds.length == _pegawaiList.length &&
          _pegawaiList.isNotEmpty) {
        _selectedIds.clear();
      } else {
        _selectedIds
          ..clear()
          ..addAll(_pegawaiList.map((p) => p.id));
      }
      _selectedTanggal.clear();
    });
  }

  void _toggleHari(int iso) {
    setState(() {
      if (_hariAktif.contains(iso)) {
        _hariAktif.remove(iso);
      } else {
        _hariAktif.add(iso);
      }
    });
  }

  bool get _canSave {
    if (_selectedIds.isEmpty || _shift == null || _shift!.isEmpty || _saving)
      return false;
    return _isReguler ? _hariAktif.isNotEmpty : _selectedTanggal.isNotEmpty;
  }

  List<JadwalPegawaiRow> get _selectedRows =>
      _pegawaiList.where((p) => _selectedIds.contains(p.id)).toList();

  // Tanggal (1-31) yg ditandai merah — cuma kalau jadwal SEBELUMNYA (nilai
  // kolom h di tanggal itu) SAMA PERSIS di semua pegawai yg dicentang &
  // tidak kosong. Kalau ada satu saja yg beda (atau kosong sementara yg
  // lain terisi), tanggal itu TIDAK ditandai merah — krn tak ada satu
  // jawaban yg mewakili semua pegawai terpilih.
  Set<int> get _tanggalTerisiSama {
    final rows = _selectedRows;
    if (rows.isEmpty) return {};
    final result = <int>{};
    for (var day = 1; day <= 31; day++) {
      final idx = day - 1;
      final first = idx < rows.first.h.length ? rows.first.h[idx] : '';
      if (first.isEmpty) continue;
      final sama =
          rows.every((p) => (idx < p.h.length ? p.h[idx] : '') == first);
      if (sama) result.add(day);
    }
    return result;
  }

  /// Nama shift yg sudah terisi (dipakai riwayat) — null kalau tanggal
  /// itu bukan bagian dari _tanggalTerisiSama.
  String? _shiftUntukTanggal(int day) {
    final rows = _selectedRows;
    if (rows.isEmpty) return null;
    final idx = day - 1;
    final value = idx < rows.first.h.length ? rows.first.h[idx] : '';
    return value.isEmpty ? null : value;
  }

  Future<void> _pilihTanggal() async {
    // Modal-nya sendiri yg urus tanda merah "sudah kepakai" (fetch data
    // sendiri, ikut update kalau digeser/swipe ke bulan lain) — di sini
    // cuma kasih tanggal pending sesi ini (blue di Riwayat Tanggal)
    // sbg referensi tambahan KHUSUS kalau modal masih di bulan yg sama.
    final result = await showTanggalPickerModal(
      context,
      tahun: _tahun,
      bulan: _bulan,
      pegawaiIds: _selectedIds.toList(),
      departemen: _departemen,
      pendingTanggal: _selectedTanggal,
    );
    if (result == null || !mounted) return;
    if (result.tahun != _tahun || result.bulan != _bulan) {
      // User geser ke bulan lain di dalam modal — samakan konteks
      // bulan Atur Jadwal ke situ juga (tanggal pending bulan LAMA
      // dibuang, gak relevan lagi ke bulan baru).
      setState(() {
        _tahun = result.tahun;
        _bulan = result.bulan;
        _selectedTanggal = result.tanggal;
      });
      await _loadPegawai();
    } else {
      setState(() => _selectedTanggal = {..._selectedTanggal, ...result.tanggal});
    }
  }

  Future<void> _simpan() async {
    if (!_canSave) return;
    setState(() => _saving = true);
    try {
      final String message;
      if (_isReguler) {
        final sortedHari = _hariAktif.toList()..sort();
        message = await JadwalPegawaiService.terapkanBulk(
            ids: _selectedIds.toList(), shift: _shift!, hariAktif: sortedHari);
      } else {
        final sortedTanggal = _selectedTanggal.toList()..sort();
        message = await JadwalPegawaiService.terapkanTanggal(
          ids: _selectedIds.toList(),
          tahun: _tahun,
          bulan: _bulan,
          tanggal: sortedTanggal,
          shift: _shift!,
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: _kGreenDark));
      // Pegawai TETAP dicentang (bukan di-clear) — supaya begitu
      // _loadPegawai selesai refresh data h dari server, tanggal yg
      // baru saja disimpan langsung kebaca _tanggalTerisiSama & tampil
      // merah kalau modal dibuka lagi, dan user bisa langsung lanjut
      // atur shift berikutnya utk pegawai yg sama tanpa centang ulang.
      setState(() => _selectedTanggal.clear());
      await _loadPegawai();
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException ? e.message : 'Gagal menyimpan jadwal.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(msg), backgroundColor: const Color(0xFFDC2626)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        title: const Text('Atur Jadwal Tetap',
            style: TextStyle(
                color: Color(0xFF111827),
                fontWeight: FontWeight.w700,
                fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildBulanNav(),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _buildDepartemenDropdown()),
                    const SizedBox(width: 12),
                    Expanded(child: _buildShiftDropdown()),
                  ],
                ),
                const SizedBox(height: 16),
                _buildPegawaiSection(),
                const SizedBox(height: 16),
                if (_shift != null)
                  (_isReguler ? _buildHariSection() : _buildTanggalSection()),
                if (_shift != null && !_isReguler) ...[
                  const SizedBox(height: 16),
                  _buildRiwayatTanggalSection(),
                ],
                const SizedBox(height: 90),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _canSave ? _simpan : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kGreenDark,
                disabledBackgroundColor: Colors.grey.shade300,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                _saving ? 'Menyimpan...' : 'Simpan',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // Navigasi bulan — jadwal (grid h1..h31, dipakai buat Riwayat Tanggal
  // & tanda merah "sudah kepakai") itu spesifik per bulan, jadi user
  // perlu bisa geser ke bulan depan/sebelumnya, bukan kekunci ke bulan
  // berjalan doang. Padanan dropdown Bulan/Tahun di JadwalPegawai.tsx
  // (desktop), tapi bentuknya prev/next spy hemat tempat di HP.
  Widget _buildBulanNav() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(10)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: () => _gantiBulan(-1),
            icon: const Icon(Icons.chevron_left, color: Color(0xFF6B7280)),
          ),
          Text('${_kBulanIndo[_bulan]} $_tahun',
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF111827))),
          IconButton(
            onPressed: () => _gantiBulan(1),
            icon: const Icon(Icons.chevron_right, color: Color(0xFF6B7280)),
          ),
        ],
      ),
    );
  }

  Widget _buildDepartemenDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Departemen',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: _kBorder),
              borderRadius: BorderRadius.circular(10)),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String?>(
              value: _departemen,
              isExpanded: true,
              hint: const Text('Semua', style: TextStyle(fontSize: 12)),
              items: [
                const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('Semua Departemen',
                        style: TextStyle(fontSize: 12))),
                ..._departemenList.map((d) => DropdownMenuItem<String?>(
                    value: d.kode,
                    child: Text(d.nama, style: const TextStyle(fontSize: 12)))),
              ],
              // Non-admin: departemen sudah otomatis terisi departemen
              // dia sendiri (lihat _initPegawai), tapi tetap bisa
              // diganti kalau perlu — gak dikunci.
              onChanged: (v) {
                setState(() => _departemen = v);
                _loadPegawai();
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildShiftDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Shift',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: _kBorder),
              borderRadius: BorderRadius.circular(10)),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _shift,
              isExpanded: true,
              hint: const Text('Pilih Shift', style: TextStyle(fontSize: 12)),
              items: _shiftList
                  .map((s) => DropdownMenuItem(
                      value: s.shift,
                      child:
                          Text(s.label, style: const TextStyle(fontSize: 12))))
                  .toList(),
              onChanged: (v) => setState(() {
                _shift = v;
                _selectedTanggal.clear();
              }),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPegawaiSection() {
    final allSelected =
        _pegawaiList.isNotEmpty && _selectedIds.length == _pegawaiList.length;
    return Container(
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
            child: Row(
              children: [
                Checkbox(
                  value: allSelected,
                  activeColor: _kGreenDark,
                  onChanged:
                      _pegawaiList.isEmpty ? null : (_) => _toggleSelectAll(),
                ),
                Expanded(
                  child: Text(
                    _selectedIds.isEmpty
                        ? 'Centang pegawai untuk atur jadwal'
                        : '${_selectedIds.length} pegawai dipilih',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _selectedIds.isEmpty
                            ? const Color(0xFF6B7280)
                            : _kGreenDark),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: _kBorder),
          // Card ini dibatasi tingginya (scroll sendiri di dalam) —
          // supaya "Hari Berlaku" + tombol Simpan tetap gampang
          // dijangkau meski departemennya banyak pegawai.
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 360),
            child: _loadingPegawai
                ? const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                        child: Text('Memuat...',
                            style: TextStyle(
                                fontSize: 12, color: Color(0xFF9CA3AF)))),
                  )
                : _pegawaiList.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(24),
                        child: Center(
                            child: Text('Tidak ada pegawai',
                                style: TextStyle(
                                    fontSize: 12, color: Color(0xFF9CA3AF)))),
                      )
                    : ListView.builder(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: _pegawaiList.length,
                        itemBuilder: (context, index) {
                          final p = _pegawaiList[index];
                          final checked = _selectedIds.contains(p.id);
                          return CheckboxListTile(
                            value: checked,
                            activeColor: _kGreenDark,
                            dense: true,
                            visualDensity: const VisualDensity(vertical: -4),
                            contentPadding:
                                const EdgeInsets.symmetric(horizontal: 4),
                            controlAffinity: ListTileControlAffinity.leading,
                            onChanged: (v) => setState(() {
                              if (v == true) {
                                _selectedIds.add(p.id);
                              } else {
                                _selectedIds.remove(p.id);
                              }
                              _selectedTanggal.clear();
                            }),
                            title: Text(p.nama,
                                style: const TextStyle(
                                    fontSize: 13, color: Color(0xFF111827))),
                            subtitle: p.jadwalTetapShift.isEmpty
                                ? null
                                : Text('Saat ini: ${p.jadwalTetapShift}',
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF9CA3AF))),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildHariSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Hari Berlaku',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF374151))),
          const SizedBox(height: 2),
          const Text('Shift ini berulang tiap minggu pada hari yg dipilih.',
              style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _kHariOpsi.map((h) {
              final active = _hariAktif.contains(h.iso);
              return GestureDetector(
                onTap: () => _toggleHari(h.iso),
                child: Container(
                  width: 44,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: active ? _kGreenDark : Colors.white,
                    border: Border.all(color: active ? _kGreenDark : _kBorder),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(h.label,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color:
                              active ? Colors.white : const Color(0xFF9CA3AF))),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              TextButton(
                  onPressed: () => setState(() => _hariAktif = {1, 2, 3, 4, 5}),
                  child: const Text('Sen–Jum')),
              TextButton(
                  onPressed: () =>
                      setState(() => _hariAktif = {1, 2, 3, 4, 5, 6, 7}),
                  child: const Text('7 Hari')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTanggalSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _pilihTanggal,
              style: OutlinedButton.styleFrom(
                foregroundColor: _kBlue,
                side: const BorderSide(color: _kBlue),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              // Tombol selalu "Atur Tanggal Masuk" — jumlah tanggal yg
              // sudah dipilih ditampilkan di card Riwayat Tanggal
              // (chip biru), bukan di label tombol, supaya tombol ini
              // tetap kelihatan siap dipakai lagi utk shift berikutnya.
              label: const Text('Atur Tanggal Masuk'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRiwayatTanggalSection() {
    // Merah = sudah tersimpan sebelumnya (sama di semua pegawai
    // terpilih). Biru = baru dipilih di modal kalender sesi ini, BELUM
    // disimpan — nunggu tombol Simpan paling bawah ditekan. Kalau
    // tanggal yg sama dipilih ulang (mau ditimpa), tampil biru (rencana
    // baru menang drpd data lama).
    final biru = _selectedTanggal.toList()..sort();
    final merah = _tanggalTerisiSama.difference(_selectedTanggal).toList()
      ..sort();
    final kosong = biru.isEmpty && merah.isEmpty;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: _kBorder),
          borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Riwayat Tanggal',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF374151))),
          if (_selectedRows.isEmpty) ...[
            const SizedBox(height: 2),
            const Text('Centang pegawai dulu utk lihat jadwal yg sudah ada.',
                style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
          ],
          const SizedBox(height: 10),
          if (kosong)
            const Text('Belum ada jadwal.',
                style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ...merah.map((d) {
                  final shift = _shiftUntukTanggal(d) ?? '-';
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(10)),
                    child: Text('$d — $shift',
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFDC2626))),
                  );
                }),
                ...biru.map((d) {
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                        color: const Color(0xFFDBEAFE),
                        borderRadius: BorderRadius.circular(10)),
                    child: Text('$d — ${_shift ?? '-'}',
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _kBlue)),
                  );
                }),
              ],
            ),
        ],
      ),
    );
  }
}
