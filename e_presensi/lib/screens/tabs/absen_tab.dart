import 'dart:math' as math;
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../models/presensi_hari_ini.dart';
import '../../services/api_client.dart';
import '../../services/presensi_service.dart';

const _kGreenDark = Color(0xFF059669);

/// Padanan AbsenTab di PresensiMobile.tsx (versi web) — kamera depan +
/// GPS, satu tombol capture-lalu-submit (bukan capture-lalu-preview-
/// lalu-konfirmasi), status "sudah lengkap hari ini" ditampilkan statis
/// tanpa kamera sama sekali.
class AbsenTab extends StatefulWidget {
  final String nik;
  final VoidCallback onSelesai;
  const AbsenTab({super.key, required this.nik, required this.onSelesai});

  @override
  State<AbsenTab> createState() => _AbsenTabState();
}

class _AbsenTabState extends State<AbsenTab> {
  bool _loadingHariIni = true;
  PresensiHariIni? _hariIni;

  CameraController? _controller;
  String? _cameraError;
  Uint8List? _captured;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadHariIni();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _loadHariIni() async {
    setState(() => _loadingHariIni = true);
    try {
      final hariIni = await PresensiService.getHariIni(widget.nik);
      if (!mounted) return;
      setState(() {
        _hariIni = hariIni;
        _loadingHariIni = false;
      });
      if (hariIni != null && !hariIni.sudahSelesaiHariIni) {
        await _initCamera();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _hariIni = null;
        _loadingHariIni = false;
      });
    }
  }

  Future<void> _initCamera() async {
    setState(() => _cameraError = null);
    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      final controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await controller.initialize();
      if (!mounted) return;
      setState(() => _controller = controller);
    } catch (e) {
      if (!mounted) return;
      setState(() => _cameraError = 'Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan.');
    }
  }

  Future<Position?> _getPosition() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        return null;
      }
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 8)),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _captureAndSubmit() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized || _submitting) return;

    setState(() => _submitting = true);
    try {
      final file = await controller.takePicture();
      final bytes = await file.readAsBytes();
      await controller.dispose();
      if (!mounted) return;
      setState(() {
        _controller = null;
        _captured = bytes;
      });

      final pos = await _getPosition();
      if (pos == null) {
        _showError('Lokasi tidak ditemukan. Aktifkan izin lokasi lalu coba lagi.');
        if (!mounted) return;
        setState(() {
          _captured = null;
          _submitting = false;
        });
        await _initCamera();
        return;
      }

      final url = await PresensiService.uploadFoto(bytes);
      final alamat = '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
      final aksi = _hariIni!.aksi;
      final result = aksi == 'checkout'
          ? await PresensiService.checkout(nik: widget.nik, lat: pos.latitude, lng: pos.longitude, alamat: alamat, photo: url)
          : await PresensiService.checkin(nik: widget.nik, lat: pos.latitude, lng: pos.longitude, alamat: alamat, photo: url);

      if (!mounted) return;
      await _showSuccess(
        aksi == 'checkout' ? 'Check-out berhasil' : 'Check-in berhasil',
        'Jam ${result['jam'] ?? '-'} · ${result['status'] ?? ''}',
      );
      if (mounted) widget.onSelesai();
    } catch (e) {
      _showError(e is ApiException ? e.message : 'Gagal menyimpan presensi, coba lagi.');
      if (!mounted) return;
      setState(() {
        _captured = null;
        _submitting = false;
      });
      await _initCamera();
      return;
    }
    if (mounted) setState(() => _submitting = false);
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: const Color(0xFFDC2626)),
    );
  }

  Future<void> _showSuccess(String title, String subtitle) async {
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: _kGreenDark, size: 48),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 4),
            Text(subtitle, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          ],
        ),
      ),
    );
    await Future.delayed(const Duration(milliseconds: 1600));
    if (mounted) Navigator.of(context, rootNavigator: true).pop();
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingHariIni) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_hariIni == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, color: Colors.grey.shade400, size: 40),
            const SizedBox(height: 12),
            Text('Gagal memuat status presensi', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            const SizedBox(height: 12),
            TextButton(onPressed: _loadHariIni, child: const Text('Coba lagi')),
          ],
        ),
      );
    }
    if (_hariIni!.sudahSelesaiHariIni) {
      return _buildSelesaiView();
    }
    return _buildCameraView();
  }

  Widget _buildSelesaiView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle_outline, color: _kGreenDark, size: 48),
          const SizedBox(height: 12),
          const Text('Presensi hari ini sudah lengkap', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 6),
          Text(
            'Check-in ${_hariIni!.jamDatang} · Check-out ${_hariIni!.jamPulang}',
            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildCameraView() {
    final canSubmit = _controller != null && _controller!.value.isInitialized && !_submitting && _captured == null;
    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: _cameraError != null
                  ? _buildCameraErrorView()
                  : Container(
                      color: Colors.black,
                      child: AspectRatio(
                        aspectRatio: 4 / 5,
                        child: _captured != null
                            ? Image.memory(_captured!, fit: BoxFit.cover)
                            : _controller != null && _controller!.value.isInitialized
                                ? _buildLivePreview(_controller!)
                                : const Center(child: CircularProgressIndicator(color: Colors.white)),
                      ),
                    ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            children: [
              if (_hariIni!.keterlambatan.isNotEmpty && _hariIni!.keterlambatan != '-')
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Anda telat ${_hariIni!.keterlambatan}',
                    style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w600, fontSize: 12),
                  ),
                ),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: canSubmit ? _captureAndSubmit : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kGreenDark,
                    disabledBackgroundColor: Colors.grey.shade300,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                    _submitting ? 'Menyimpan...' : (_hariIni!.aksi == 'checkout' ? 'Absen — Pulang' : 'Absen — Masuk'),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLivePreview(CameraController controller) {
    // Preview dari kamera depan dibalik horizontal spy selfie (padanan
    // CSS transform: scaleX(-1) di web) — hanya tampilan, foto yg
    // diupload tetap orientasi asli sensor.
    final size = controller.value.previewSize;
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: size?.height ?? 1,
        height: size?.width ?? 1,
        child: Transform(
          alignment: Alignment.center,
          transform: Matrix4.rotationY(math.pi),
          child: CameraPreview(controller),
        ),
      ),
    );
  }

  Widget _buildCameraErrorView() {
    return Container(
      color: const Color(0xFFF3F4F6),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.videocam_off_outlined, color: Colors.grey.shade400, size: 40),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text(_cameraError!, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: _initCamera, child: const Text('Coba lagi')),
          ],
        ),
      ),
    );
  }
}
