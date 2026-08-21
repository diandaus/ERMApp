import 'package:flutter/material.dart';

import '../../models/jadwal_row.dart';
import '../../services/presensi_service.dart';

const _kGreenDark = Color(0xFF059669);
const _kBorder = Color(0xFFE5E7EB);
const _kRedDark = Color(0xFFDC2626);
const _kRedBg = Color(0xFFFEF2F2);
const _kRedBadgeBg = Color(0xFFFEE2E2);

const _kHariIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
const _kBulanIndo = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/// Padanan JadwalTab di PresensiMobile.tsx — daftar jadwal shift sebulan
/// (read-only, tanpa navigasi bulan, selalu bulan berjalan spt versi web).
class JadwalTab extends StatefulWidget {
  final String nik;
  const JadwalTab({super.key, required this.nik});

  @override
  State<JadwalTab> createState() => _JadwalTabState();
}

class _JadwalTabState extends State<JadwalTab> {
  bool _loading = true;
  List<JadwalRow> _list = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await PresensiService.getJadwal(widget.nik);
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final todayStr = '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

    return RefreshIndicator(
      onRefresh: _load,
      color: _kGreenDark,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Jadwal Shift — ${_kBulanIndo[now.month]} ${now.year}',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('Memuat...', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
            )
          else if (_list.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('Belum ada jadwal', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))),
            )
          else
            ..._list.map((row) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: _JadwalRowTile(row: row, isToday: row.tanggal == todayStr),
                )),
        ],
      ),
    );
  }
}

class _JadwalRowTile extends StatelessWidget {
  final JadwalRow row;
  final bool isToday;
  const _JadwalRowTile({required this.row, required this.isToday});

  @override
  Widget build(BuildContext context) {
    final tgl = DateTime.tryParse(row.tanggal);
    final hariLabel = tgl != null ? '${tgl.day} ${_kHariIndo[tgl.weekday % 7]}' : row.tanggal;
    final adaJadwal = row.adaJadwal;
    final tanggalMerah = row.isTanggalMerah;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isToday ? const Color(0xFFECFDF5) : (tanggalMerah ? _kRedBg : Colors.white),
        border: Border.all(color: isToday ? _kGreenDark : (tanggalMerah ? _kRedDark : _kBorder)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      hariLabel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: tanggalMerah ? _kRedDark : const Color(0xFF111827),
                      ),
                    ),
                    if (isToday)
                      const Padding(
                        padding: EdgeInsets.only(left: 6),
                        child: Text('HARI INI', style: TextStyle(fontSize: 9, color: _kGreenDark, fontWeight: FontWeight.w700)),
                      ),
                  ],
                ),
                if (tanggalMerah)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      row.keteranganLibur,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: _kRedDark),
                    ),
                  ),
                if (adaJadwal)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '${_hhmm(row.jamMasuk)} – ${_hhmm(row.jamPulang)}',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: adaJadwal
                  ? const Color(0xFFD1FAE5)
                  : (tanggalMerah ? _kRedBadgeBg : const Color(0xFFF3F4F6)),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              adaJadwal ? row.shift : 'Libur',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: adaJadwal ? const Color(0xFF047857) : (tanggalMerah ? _kRedDark : const Color(0xFF9CA3AF)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _hhmm(String hhmmss) => hhmmss.length >= 5 ? hhmmss.substring(0, 5) : hhmmss;
}
