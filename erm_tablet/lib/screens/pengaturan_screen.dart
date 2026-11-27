import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../models/app_user.dart';
import '../services/api_config.dart';
import '../services/auth_service.dart';
import '../services/instansi_service.dart';
import '../services/update_service.dart';
import '../theme/app_theme.dart';
import '../widgets/pembaruan_dialog.dart';
import 'main_shell.dart' show confirmLogout;

/// PengaturanScreen — halaman Pengaturan (dibuka dari menu akun navbar).
/// Tata letak mengikuti referensi user (aplikasi kasir): kolom menu kiri
/// dgn header "Pengaturan" + kelompok (AKUN / APLIKASI), panel isi kanan
/// dgn header judul menu terpilih; baris isi = judul + keterangan abu,
/// tombol outline tosca rata kanan, dipisah garis tipis.
class PengaturanScreen extends StatefulWidget {
  final AppUser user;
  final VoidCallback onLogout;

  /// true -> langsung buka menu Lainnya (dari notifikasi pembaruan).
  final bool bukaLainnya;

  /// true = tertanam sbg tab "Saya" (portrait, MainShell) — tanpa tombol kembali.
  final bool embedded;
  const PengaturanScreen({super.key, required this.user, required this.onLogout, this.bukaLainnya = false, this.embedded = false});

  @override
  State<PengaturanScreen> createState() => _PengaturanScreenState();
}

enum _Menu { profil, kataSandi, server, lainnya }

class _MenuItem {
  final _Menu menu;
  final String label;
  final IconData icon;
  const _MenuItem(this.menu, this.label, this.icon);
}

const _kAkun = [
  _MenuItem(_Menu.profil, 'Profil Saya', Icons.badge_outlined),
  _MenuItem(_Menu.kataSandi, 'Kata Sandi', Icons.lock_outline),
];
const _kAplikasi = [
  _MenuItem(_Menu.server, 'Server & Koneksi', Icons.dns_outlined),
  _MenuItem(_Menu.lainnya, 'Lainnya', Icons.more_horiz),
];

const _kRed = Color(0xFFDC2626);

class _PengaturanScreenState extends State<PengaturanScreen> {
  late _Menu _menu = widget.bukaLainnya ? _Menu.lainnya : _Menu.profil;

  String get _judul => [..._kAkun, ..._kAplikasi].firstWhere((m) => m.menu == _menu).label;

  void _keluar() {
    confirmLogout(context, () {
      // Tutup halaman Pengaturan dulu, baru logout (home -> LoginScreen).
      Navigator.of(context).popUntil((r) => r.isFirst);
      widget.onLogout();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kPrimaryDark,
      body: SafeArea(
        bottom: false,
        child: Container(
          color: Colors.white,
          // Layar sempit (portrait): daftar menu saja, ketuk menu = buka
          // halaman detailnya. Layar lebar: menu kiri + isi kanan.
          child: LayoutBuilder(
            builder: (context, box) => box.maxWidth < 720
                ? _buildSidebar(sempit: true)
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(width: 300, child: _buildSidebar()),
                      const VerticalDivider(width: 1, color: kLine),
                      Expanded(child: _buildContent()),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  /// Mode sempit: halaman detail satu menu (header ← + judul + isi).
  void _bukaHalaman(_MenuItem m) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        backgroundColor: kPrimaryDark,
        body: SafeArea(
          bottom: false,
          child: Container(
            color: Colors.white,
            child: Column(children: [
              Builder(
                builder: (ctx) => _header(
                  leading: IconButton(
                    tooltip: 'Kembali',
                    onPressed: () => Navigator.of(ctx).pop(),
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                  ),
                  title: m.label,
                ),
              ),
              Expanded(child: _pane(m.menu)),
            ]),
          ),
        ),
      ),
    ));
  }

  Widget _header({Widget? leading, required String title}) {
    return Container(
      height: 60,
      color: kPrimary,
      padding: EdgeInsets.only(left: leading == null ? 24 : 8, right: 16),
      child: Row(children: [
        if (leading != null) ...[leading, const SizedBox(width: 4)],
        Expanded(
          child: Text(title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white)),
        ),
      ]),
    );
  }

  Widget _buildSidebar({bool sempit = false}) {
    Widget item(_MenuItem m) {
      final sel = !sempit && m.menu == _menu;
      return _SidebarTile(
        icon: m.icon,
        label: m.label,
        selected: sel,
        trailing: sempit ? const Icon(Icons.chevron_right, color: kTextMuted) : null,
        onTap: sempit ? () => _bukaHalaman(m) : () => setState(() => _menu = m.menu),
      );
    }

    return Column(children: [
      _header(
        leading: widget.embedded
            ? null
            : IconButton(
                tooltip: 'Kembali',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back, color: Colors.white),
              ),
        title: 'Pengaturan',
      ),
      Expanded(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            const _GroupLabel('AKUN'),
            ..._kAkun.map(item),
            const SizedBox(height: 12),
            const _GroupLabel('APLIKASI'),
            ..._kAplikasi.map(item),
            const SizedBox(height: 4),
            _SidebarTile(icon: Icons.logout, label: 'Keluar', selected: false, color: _kRed, onTap: _keluar),
          ],
        ),
      ),
    ]);
  }

  Widget _pane(_Menu menu) {
    switch (menu) {
      case _Menu.profil:
        return _ProfilPane(user: widget.user);
      case _Menu.kataSandi:
        return _KataSandiPane(user: widget.user);
      case _Menu.server:
        return const _ServerPane();
      case _Menu.lainnya:
        return const _LainnyaPane();
    }
  }

  Widget _buildContent() {
    return Column(children: [
      _header(title: _judul),
      Expanded(child: KeyedSubtree(key: ValueKey(_menu), child: _pane(_menu))),
    ]);
  }
}

// ── Komponen sidebar ────────────────────────────────────────────────────

class _GroupLabel extends StatelessWidget {
  final String text;
  const _GroupLabel(this.text);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 12, 28, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(text,
            style: const TextStyle(fontSize: 13, letterSpacing: 1.2, fontWeight: FontWeight.w500, color: kTextMuted)),
        const SizedBox(height: 10),
        const Divider(height: 1),
        const SizedBox(height: 4),
      ]),
    );
  }
}

class _SidebarTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final Color? color;
  final Widget? trailing;
  final VoidCallback onTap;
  const _SidebarTile(
      {required this.icon, required this.label, required this.selected, required this.onTap, this.color, this.trailing});

  @override
  Widget build(BuildContext context) {
    final fg = color ?? (selected ? kPrimaryDark : kText);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: Material(
        color: selected ? kPrimarySoft : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: selected
                ? BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: kPrimary, width: 1.5))
                : null,
            child: Row(children: [
              Icon(icon, size: 22, color: color ?? (selected ? kPrimaryDark : kTextMuted)),
              const SizedBox(width: 18),
              Expanded(
                child: Text(label,
                    style:
                        TextStyle(fontSize: 16, fontWeight: selected ? FontWeight.w600 : FontWeight.w500, color: fg)),
              ),
              if (trailing != null) trailing!,
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Komponen panel isi ──────────────────────────────────────────────────

/// Baris isi panel kanan: judul + keterangan (abu) di kiri, aksi di kanan.
class _Row extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool last;
  const _Row({required this.title, this.subtitle, this.trailing, this.last = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 72),
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: last ? null : const BoxDecoration(border: Border(bottom: BorderSide(color: kLine))),
      child: Row(children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: kText)),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(subtitle!, style: const TextStyle(fontSize: 14, color: kTextMuted)),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 16), trailing!],
      ]),
    );
  }
}

/// Tombol outline gaya referensi (tosca; merah utk aksi berbahaya).
class _OutlineBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color color;
  final bool loading;
  const _OutlineBtn({required this.label, required this.onPressed, this.color = kPrimaryDark, this.loading = false});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: loading ? null : onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color, width: 1.5),
        minimumSize: const Size(130, 46),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
      child: loading
          ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: color))
          : Text(label),
    );
  }
}

class _Pane extends StatelessWidget {
  final List<Widget> children;
  const _Pane({required this.children});
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(40, 12, 40, 32),
      children: children,
    );
  }
}

void _toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? _kRed : null));
}

// ── Profil Saya ─────────────────────────────────────────────────────────

class _ProfilPane extends StatelessWidget {
  final AppUser user;
  const _ProfilPane({required this.user});

  String _v(String s) => s.trim().isEmpty ? '-' : s;

  @override
  Widget build(BuildContext context) {
    return _Pane(children: [
      _Row(title: 'Nama Lengkap', subtitle: _v(user.fullName)),
      _Row(title: 'Username', subtitle: _v(user.username)),
      _Row(title: 'Role', subtitle: _v(user.role)),
      _Row(title: 'NIP', subtitle: _v(user.nip)),
      if (user.isDokter || user.kdDokter.isNotEmpty)
        _Row(
            title: 'Kode Dokter',
            subtitle: user.kdDokter.isEmpty
                ? 'Belum ditautkan — minta admin menautkan di Pengaturan > User (web)'
                : user.kdDokter),
      const _Row(
        title: 'Ubah data profil',
        subtitle: 'Nama, role & tautan dokter diatur admin lewat ERMApp web (Pengaturan > User).',
        last: true,
      ),
    ]);
  }
}

// ── Kata Sandi ──────────────────────────────────────────────────────────

class _KataSandiPane extends StatefulWidget {
  final AppUser user;
  const _KataSandiPane({required this.user});
  @override
  State<_KataSandiPane> createState() => _KataSandiPaneState();
}

class _KataSandiPaneState extends State<_KataSandiPane> {
  final _lama = TextEditingController();
  final _baru = TextEditingController();
  final _ulang = TextEditingController();
  bool _show = false;
  bool _saving = false;

  @override
  void dispose() {
    _lama.dispose();
    _baru.dispose();
    _ulang.dispose();
    super.dispose();
  }

  Future<void> _simpan() async {
    if (_lama.text.isEmpty || _baru.text.isEmpty) {
      _toast(context, 'Kata sandi lama dan baru wajib diisi', error: true);
      return;
    }
    if (_baru.text.length < 6) {
      _toast(context, 'Kata sandi baru minimal 6 karakter', error: true);
      return;
    }
    if (_baru.text != _ulang.text) {
      _toast(context, 'Ulangi kata sandi baru tidak sama', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await AuthService.changePassword(widget.user.id, _lama.text, _baru.text);
      if (!mounted) return;
      _lama.clear();
      _baru.clear();
      _ulang.clear();
      _toast(context, 'Kata sandi berhasil diubah');
    } catch (e) {
      if (mounted) _toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String label, TextEditingController c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: kText)),
        const SizedBox(height: 8),
        TextField(
          controller: c,
          obscureText: !_show,
          style: const TextStyle(fontSize: 15),
          decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 14)),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _Pane(children: [
      const _Row(
        title: 'Ubah Kata Sandi',
        subtitle: 'Kata sandi dipakai bersama untuk login ERMApp web & ERM Tablet.',
      ),
      const SizedBox(height: 20),
      Align(
        alignment: Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _field('Kata Sandi Lama', _lama),
            _field('Kata Sandi Baru', _baru),
            _field('Ulangi Kata Sandi Baru', _ulang),
            Row(children: [
              Checkbox(value: _show, onChanged: (v) => setState(() => _show = v ?? false)),
              const Text('Tampilkan kata sandi', style: TextStyle(fontSize: 14)),
              const Spacer(),
              _OutlineBtn(label: 'Simpan', loading: _saving, onPressed: _simpan),
            ]),
          ]),
        ),
      ),
    ]);
  }
}

// ── Server & Koneksi ────────────────────────────────────────────────────

class _ServerPane extends StatefulWidget {
  const _ServerPane();
  @override
  State<_ServerPane> createState() => _ServerPaneState();
}

class _ServerPaneState extends State<_ServerPane> {
  bool _testing = false;
  bool? _ok;
  String _detail = '';
  InstansiInfo? _instansi;

  @override
  void initState() {
    super.initState();
    _tes();
  }

  Future<void> _tes() async {
    setState(() => _testing = true);
    final sw = Stopwatch()..start();
    try {
      final info = await InstansiService.get();
      sw.stop();
      if (!mounted) return;
      setState(() {
        _ok = true;
        _instansi = info;
        _detail = 'Terhubung — waktu respons ${sw.elapsedMilliseconds} ms';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _ok = false;
        _detail = 'Tidak terhubung — $e';
      });
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _ok == null ? 'Memeriksa...' : _detail;
    return _Pane(children: [
      _Row(title: 'Alamat Server', subtitle: kApiBaseUrl),
      _Row(
        title: 'Status Koneksi',
        subtitle: status,
        trailing: _OutlineBtn(label: 'Tes Koneksi', loading: _testing, onPressed: _tes),
      ),
      _Row(
        title: 'Instansi',
        subtitle: (_instansi?.nama ?? '').isEmpty ? '-' : _instansi!.nama,
        last: true,
      ),
    ]);
  }
}

// ── Lainnya ─────────────────────────────────────────────────────────────

class _LainnyaPane extends StatefulWidget {
  const _LainnyaPane();
  @override
  State<_LainnyaPane> createState() => _LainnyaPaneState();
}

class _LainnyaPaneState extends State<_LainnyaPane> {
  String _versi = '...';
  String _model = '...';
  bool _cekUpdate = false;
  String _statusUpdate = '';
  CekUpdateHasil? _hasilUpdate;

  @override
  void initState() {
    super.initState();
    _load();
    if (UpdateService.didukung) _cek(diam: true);
  }

  /// [diam] = cek otomatis saat panel dibuka (tanpa dialog/snackbar).
  Future<void> _cek({bool diam = false}) async {
    setState(() {
      _cekUpdate = true;
      _statusUpdate = 'Memeriksa pembaruan...';
    });
    try {
      final h = await UpdateService.cek();
      if (!mounted) return;
      setState(() {
        _hasilUpdate = h;
        _statusUpdate = h.adaUpdate
            ? 'Versi baru ${h.terbaru!.versi} (build ${h.terbaru!.buildNumber}) tersedia'
            : 'Aplikasi sudah versi terbaru';
      });
      if (!diam && h.adaUpdate) await tawarkanPembaruan(context, h);
    } catch (e) {
      if (mounted) setState(() => _statusUpdate = 'Gagal memeriksa pembaruan — $e');
    } finally {
      if (mounted) setState(() => _cekUpdate = false);
    }
  }

  Future<void> _load() async {
    try {
      final p = await PackageInfo.fromPlatform();
      if (mounted) setState(() => _versi = '${p.version} (build ${p.buildNumber})');
    } catch (_) {
      if (mounted) setState(() => _versi = '-');
    }
    try {
      String m = '-';
      if (!kIsWeb && Platform.isAndroid) {
        final a = await DeviceInfoPlugin().androidInfo;
        m = '${a.manufacturer} ${a.model} — Android ${a.version.release}';
      } else if (!kIsWeb && Platform.isIOS) {
        final i = await DeviceInfoPlugin().iosInfo;
        m = '${i.name} — iOS ${i.systemVersion}';
      } else if (!kIsWeb) {
        m = '${Platform.operatingSystem} ${Platform.operatingSystemVersion}';
      }
      if (mounted) setState(() => _model = m);
    } catch (_) {
      if (mounted) setState(() => _model = '-');
    }
  }

  Future<void> _lupakanUsername() async {
    await AuthService.forgetRememberedUsername();
    if (mounted) _toast(context, 'Username tersimpan di layar login sudah dihapus');
  }

  @override
  Widget build(BuildContext context) {
    return _Pane(children: [
      _Row(title: 'Versi Aplikasi', subtitle: _versi),
      _Row(title: 'Model Perangkat', subtitle: _model),
      if (UpdateService.didukung)
        _Row(
          title: 'Pembaruan Aplikasi',
          subtitle: _statusUpdate,
          trailing: _hasilUpdate?.adaUpdate == true && !_cekUpdate
              ? _OutlineBtn(label: 'Perbarui', onPressed: () => tawarkanPembaruan(context, _hasilUpdate!))
              : _OutlineBtn(label: 'Cek Update', loading: _cekUpdate, onPressed: () => _cek()),
        ),
      _Row(
        title: 'Lupakan Username',
        subtitle: 'Hapus username yang diingat di layar login (“Ingat saya”).',
        trailing: _OutlineBtn(label: 'Hapus', color: _kRed, onPressed: _lupakanUsername),
        last: true,
      ),
    ]);
  }
}
