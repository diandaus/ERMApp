import 'dart:async';
import 'package:flutter/material.dart';
import '../models/pegawai_option.dart';
import '../services/pegawai_service.dart';

/// Dialog cari pegawai — padanan ModalCariPegawai.tsx (web), dipakai field
/// "Pegawai" di form SOAP/CPPT (siapa yg mengisi catatan ini).
Future<PegawaiOption?> showPegawaiPicker(BuildContext context) {
  return showDialog<PegawaiOption>(
    context: context,
    builder: (_) => const _PegawaiPickerDialog(),
  );
}

class _PegawaiPickerDialog extends StatefulWidget {
  const _PegawaiPickerDialog();

  @override
  State<_PegawaiPickerDialog> createState() => _PegawaiPickerDialogState();
}

class _PegawaiPickerDialogState extends State<_PegawaiPickerDialog> {
  final _searchCtrl = TextEditingController();
  List<PegawaiOption> _list = [];
  bool _loading = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(q));
  }

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      final list = await PegawaiService.search(q);
      if (!mounted) return;
      setState(() {
        _list = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _list = [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420, maxHeight: 520),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Cari Pegawai', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              TextField(
                controller: _searchCtrl,
                autofocus: true,
                onChanged: _onChanged,
                decoration: const InputDecoration(
                  hintText: 'Cari nama / NIK / jabatan...',
                  prefixIcon: Icon(Icons.search, size: 18),
                  isDense: true,
                  border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
                ),
              ),
              const SizedBox(height: 8),
              Flexible(
                child: _loading
                    ? const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
                    : _list.isEmpty
                        ? const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Tidak ada hasil', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)))))
                        : ListView.builder(
                            shrinkWrap: true,
                            itemCount: _list.length,
                            itemBuilder: (context, i) {
                              final p = _list[i];
                              return ListTile(
                                dense: true,
                                title: Text(p.nama, style: const TextStyle(fontSize: 13)),
                                subtitle: Text('${p.nik} · ${p.jbtn}', style: const TextStyle(fontSize: 11)),
                                onTap: () => Navigator.of(context).pop(p),
                              );
                            },
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
