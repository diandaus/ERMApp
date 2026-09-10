import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'models/app_user.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
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
    AuthService.getSavedUser().then((u) {
      if (!mounted) return;
      setState(() {
        _user = u;
        _checkingSession = false;
      });
    });
  }

  void _handleLoggedIn(AppUser user) {
    setState(() => _user = user);
  }

  void _handleLogout() {
    AuthService.logout();
    setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ERM Tablet',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF2563EB),
        scaffoldBackgroundColor: const Color(0xFFF9FAFB),
      ),
      home: _checkingSession
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _user == null
              ? LoginScreen(onLoggedIn: _handleLoggedIn)
              : MainShell(user: _user!, onLogout: _handleLogout),
    );
  }
}
