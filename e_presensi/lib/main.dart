import 'package:flutter/material.dart';
import 'models/app_user.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';

void main() {
  runApp(const EPresensiApp());
}

class EPresensiApp extends StatefulWidget {
  const EPresensiApp({super.key});

  @override
  State<EPresensiApp> createState() => _EPresensiAppState();
}

class _EPresensiAppState extends State<EPresensiApp> {
  AppUser? _user;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final saved = await AuthService.getSavedUser();
    setState(() {
      _user = saved;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'E-Presensi',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF059669),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(filled: true, fillColor: Colors.white),
      ),
      home: _checking
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _user == null
              ? LoginScreen(onLoggedIn: (u) => setState(() => _user = u))
              : MainShell(user: _user!, onLoggedOut: () => setState(() => _user = null)),
    );
  }
}
