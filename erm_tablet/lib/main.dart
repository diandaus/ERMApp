import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'theme/app_theme.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'models/app_user.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'services/akses_service.dart';
import 'services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Perlu diinisialisasi dulu sebelum DateFormat('...', 'id_ID') dipakai
  // (JadwalObatTab) — tanpa ini throw LocaleDataException saat runtime.
  await initializeDateFormatting('id_ID', null);
  runApp(const ErmTabletApp());
}

class ErmTabletApp extends StatefulWidget {
  const ErmTabletApp({super.key});

  @override
  State<ErmTabletApp> createState() => _ErmTabletAppState();
}

class _ErmTabletAppState extends State<ErmTabletApp> {
  AppUser? _user;
  bool _checkingSession = true;

  @override
  void initState() {
    super.initState();
    AuthService.getSavedUser().then((u) async {
      // Hak akses menu/tab akun ini dimuat SEBELUM shell tampil.
      if (u != null) await AksesService.load(u.id);
      if (!mounted) return;
      setState(() {
        _user = u;
        _checkingSession = false;
      });
    });
  }

  Future<void> _handleLoggedIn(AppUser user) async {
    await AksesService.load(user.id);
    if (mounted) setState(() => _user = user);
  }

  void _handleLogout() {
    AuthService.logout();
    AksesService.reset();
    setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ERM Tablet',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      locale: const Locale('id', 'ID'),
      supportedLocales: const [Locale('id', 'ID'), Locale('en', 'US')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: _checkingSession
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _user == null
              ? LoginScreen(onLoggedIn: _handleLoggedIn)
              : MainShell(user: _user!, onLogout: _handleLogout),
    );
  }
}
