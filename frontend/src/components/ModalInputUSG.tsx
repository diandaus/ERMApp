import React from 'react';
import { tandaTanganDokumen, mintaOtpBaru, cariOrderIdTte, unduhDokumenTte } from '../modules/peruriTteRingkasan';
import { buildHasilRadiologiPdfUntukTtd } from '../utils/hasilRadiologiPdf';
import { resolvePetugasDefault } from '../utils/mappingPetugas';
import Swal from 'sweetalert2';
import { getCurrentUserNip } from '../utils/currentUser';

// ModalInputUSG.tsx — "Input Hasil Pemeriksaan USG" (Pemeriksaan.tsx tab
// "Pemeriksaan USG", RadTab.tsx kategoriUsg). SENGAJA modal BARU & TERPISAH
// dari ModalHasilRadiologi.tsx (dipakai modul Radiologi.tsx/worklist
// lintas pasien) — bukan reuse, krn ModalHasilRadiologi punya bagian "Foto
// dari Orthanc" yg fallback cari SEMUA studi pasien by No.RM begitu
// AccessionNumber belum ketemu (padanan tbListDicom Khanza lama, lihat
// getDicomPreviewList di dicom_handler.go) — utk order USG yg BARU dibuat
// & belum pernah dikirim ke Orthanc, ini malah nampilin foto rontgen LAMA
// yg tidak relevan sama sekali (ketauan dari screenshot user, order baru
// tapi foto tulang belakang lama ikut muncul).
//
// Modal ini TETAP menampilkan foto (reuse endpoint yg sama, GET
// /api/satu-sehat/dicom/preview-image/:noorder), TAPI cuma kalau
// data.search_mode === 'accession_number' — artinya studi itu BENAR-BENAR
// dari mesin USG utk order ini (AccessionNumber = noorder ketemu persis di
// Orthanc), BUKAN hasil fallback lintas riwayat by No.RM. Kalau
// search_mode 'patient_id' (fallback), foto TIDAK ditampilkan sama sekali
// (biarkan kosong "Belum ada foto") — inilah yg menghindari bug foto lama
// nyasar ke order baru.
//
// Shell slide-in dari kanan PERSIS pola ModalInputRad.tsx/ModalInputLab.tsx
// (overlay fixed + panel anchor kanan, header breadcrumb pasien + close
// bulat, body scrollable, footer sticky "Simpan"). Backend REUSE 100% yg
// sudah ada (POST /api/radiologi/hasil, GET /api/radiologi/permintaan/:noorder
// — radiologi_hasil_handler.go, sudah mereplikasi persis simpan() di
// DlgPeriksaRadiologi.java Khanza), tidak ada perubahan backend.
//
// Dokter P.J. SENGAJA read-only, terkunci ke dokter poliklinik pasien ini
// (patient.kd_dokter/nm_dokter dari Pemeriksaan.tsx — DPJP kunjungan) —
// bukan dipilih manual spt ModalHasilRadiologi, krn alur USG Kandungan:
// dokter poliklinik yg periksa sendiri, tidak ada radiolog terpisah.
// Field Dokter Perujuk SENGAJA disembunyikan (tidak relevan ditampilkan
// di alur ini, dokter P.J. sekaligus perujuknya) — datanya tetap dikirim
// ke backend sbg patient.kd_dokter di handleSubmit, cuma tanpa input field.

type ModalInputUSGProps = {
  patient: any;
  noorder: string;
  onClose: () => void;
  onSaved: () => void;
};

type ExamRow = { kd_jenis_prw: string; nm_perawatan: string };
type DicomInstance = { id: string; series_id: string; modality: string };

// Kesimpulan/Kesan & Saran/Anjuran — hasil_radiologi Khanza cuma py SATU
// kolom teks (hasil), tidak ada tabel kesan/saran radiologi (beda dgn
// saran_kesan_lab). Jadi keduanya digabung ke kolom hasil dgn judul baris
// sendiri, supaya ikut tampil di semua tempat yg membaca hasil (tab
// Pemeriksaan, Khanza desktop, cetak riwayat). Saat dibuka lagi dipecah
// balik ke 3 kolom lewat judul yg sama.
const LABEL_KESAN = 'Kesimpulan/Kesan:';
const LABEL_SARAN = 'Saran/Anjuran:';

export function composeHasilUsg(hasil: string, kesan: string, saran: string): string {
  const parts = [hasil.trim()];
  if (kesan.trim()) parts.push(`${LABEL_KESAN}\n${kesan.trim()}`);
  if (saran.trim()) parts.push(`${LABEL_SARAN}\n${saran.trim()}`);
  return parts.join('\n\n');
}

export function parseHasilUsg(teks: string): { hasil: string; kesan: string; saran: string } {
  const lines = teks.split(/\r?\n/);
  const out = { hasil: [] as string[], kesan: [] as string[], saran: [] as string[] };
  let cur: keyof typeof out = 'hasil';
  for (const line of lines) {
    const t = line.trim();
    if (t === LABEL_KESAN) { cur = 'kesan'; continue; }
    if (t === LABEL_SARAN) { cur = 'saran'; continue; }
    out[cur].push(line);
  }
  return { hasil: out.hasil.join('\n').trim(), kesan: out.kesan.join('\n').trim(), saran: out.saran.join('\n').trim() };
}

export const ModalInputUSG: React.FC<ModalInputUSGProps> = ({ patient, noorder, onClose, onSaved }) => {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const [loading, setLoading] = React.useState(true);
  const [exams, setExams] = React.useState<ExamRow[]>([]);
  const [hasil, setHasil] = React.useState('');
  const [kesan, setKesan] = React.useState('');
  const [saran, setSaran] = React.useState('');
  // Template hasil USG (per dokter poliklinik pasien) — checkbox
  // "Jadikan template" ikut menyimpan template saat Simpan; tombol
  // "Template" membuka daftar template utk mengisi form.
  const [jadikanTemplate, setJadikanTemplate] = React.useState(false);
  const [namaTemplate, setNamaTemplate] = React.useState('');
  const [showTemplateModal, setShowTemplateModal] = React.useState(false);

  const [petugasQuery, setPetugasQuery] = React.useState('');
  const [petugasNip, setPetugasNip] = React.useState('');
  const [petugasList, setPetugasList] = React.useState<{ nip: string; nama: string }[]>([]);
  const [showPetugasDropdown, setShowPetugasDropdown] = React.useState(false);

  const [otomatisJam, setOtomatisJam] = React.useState(true);
  const [tglPeriksa, setTglPeriksa] = React.useState('');
  const [jamPeriksa, setJamPeriksa] = React.useState('');

  const [saving, setSaving] = React.useState(false);
  const [previewingPdf, setPreviewingPdf] = React.useState(false);
  // TTE Peruri — nama dokumen di tracking (awalan "USG_" → jenis "Hasil
  // USG" di Peruri > Selesai) & file Berkas Rawat USG_<no_rawat>_<noorder>_signed.pdf.
  const namaDokumenTte = `USG_${noorder}_${String(patient?.no_rawat || '').replace(/\//g, '')}.pdf`;
  const opsiBerkasTte = { no_rawat: patient?.no_rawat || '', no_order: noorder, prefix: 'USG_' };
  const [sudahAdaHasil, setSudahAdaHasil] = React.useState(false);
  const [lastTteOrderId, setLastTteOrderId] = React.useState('');
  const [tteBusy, setTteBusy] = React.useState<'' | 'otp' | 'unduh' | 'ttd'>('');

  React.useEffect(() => {
    if (!patient?.no_rawat) return;
    let aktif = true;
    cariOrderIdTte(patient.no_rawat, namaDokumenTte).then((id) => { if (aktif && id) setLastTteOrderId(id); });
    return () => { aktif = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.no_rawat, noorder]);

  const buatPdfTte = (preview: boolean) => buildHasilRadiologiPdfUntukTtd({
    noorder,
    kdDokterPj: patient.kd_dokter,
    namaDokterPj: patient.nm_dokter || '',
    hasil,
    kesan,
    saran,
    judul: 'HASIL PEMERIKSAAN USG',
    preview,
    varian: 'usg',
  });

  // Tanda Tangan — PDF dari isi form (sama dgn Preview PDF), lalu alur TTE
  // Peruri (sesi OTP 24 jam) & OTOMATIS tersimpan ke Berkas Rawat, persis
  // Ringkasan Perawatan di menu Peruri. Hasil WAJIB sudah disimpan dulu
  // supaya tanggal/jam pemeriksaan di PDF sesuai data tersimpan.
  const handleTandaTanganUsg = async () => {
    if (!patient.kd_dokter) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Dokter poliklinik pasien ini belum diketahui — periksa data kunjungan.' });
      return;
    }
    if (!sudahAdaHasil) {
      Swal.fire({ icon: 'warning', title: 'Simpan hasil dulu', text: 'Simpan Hasil Pemeriksaan USG terlebih dahulu, lalu buka lagi untuk ditandatangani.' });
      return;
    }
    if (!hasil.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Isi Hasil Pemeriksaan dulu' });
      return;
    }
    if (jadikanTemplate && !namaTemplate.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Isi Nama Template dulu (atau hilangkan centang Jadikan template).' });
      return;
    }
    setTteBusy('ttd');
    try {
      const orderId = await tandaTanganDokumen({
        no_rawat: patient.no_rawat,
        kd_dokter: patient.kd_dokter,
        nm_dokter: patient.nm_dokter || patient.kd_dokter,
        labelHtml: `Hasil Pemeriksaan USG <b>${String(patient.nm_pasien || '').replace(/[<>&]/g, '')}</b> (${patient.no_rawat})`,
        namaDokumen: namaDokumenTte,
        buatPdf: () => buatPdfTte(false),
        simpanKeBerkas: opsiBerkasTte,
      });
      if (orderId) setLastTteOrderId(orderId);
    } finally {
      setTteBusy('');
    }
  };

  const handleOtpUsg = async () => {
    if (!patient.kd_dokter) return;
    setTteBusy('otp');
    try {
      await mintaOtpBaru({ kd_dokter: patient.kd_dokter, nm_dokter: patient.nm_dokter || patient.kd_dokter });
    } finally {
      setTteBusy('');
    }
  };

  const handleUnduhUsg = async () => {
    const orderId = lastTteOrderId || await cariOrderIdTte(patient.no_rawat, namaDokumenTte);
    if (!orderId) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Belum ada dokumen yang ditandatangani. Lakukan Tanda Tangan dulu.' });
      return;
    }
    setTteBusy('unduh');
    try {
      await unduhDokumenTte(orderId, namaDokumenTte, opsiBerkasTte);
    } finally {
      setTteBusy('');
    }
  };

  // Preview PDF — buka PDF hasil USG yg AKAN dikirim ke Peruri utk TTE
  // (pembuat PDF yg sama dgn Hasil Radiologi, utils/hasilRadiologiPdf.ts)
  // di tab baru, TANPA kirim apa pun. Isi hasil diambil dari form yg sedang
  // diketik (termasuk Kesimpulan/Kesan & Saran/Anjuran); Penanggung Jawab =
  // dokter poliklinik pasien.
  const handlePreviewPdf = async () => {
    if (!patient.kd_dokter) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Dokter poliklinik pasien ini belum diketahui — periksa data kunjungan.' });
      return;
    }
    const win = window.open('', '_blank');
    setPreviewingPdf(true);
    try {
      const { pdfBytes } = await buatPdfTte(true);
      const url = URL.createObjectURL(new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }));
      if (win) win.location.href = url; else window.open(url, '_blank');
    } catch (err) {
      win?.close();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setPreviewingPdf(false);
    }
  };

  const [foto, setFoto] = React.useState<{ instances: DicomInstance[] }>({ instances: [] });
  const [loadingFoto, setLoadingFoto] = React.useState(false);
  const [previewFoto, setPreviewFoto] = React.useState<string | null>(null);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Muat detail permintaan — daftar pemeriksaan (biasanya cuma "USG",
  // kode RJ.OBG) + hasil/petugas yg SUDAH pernah diisi sebelumnya (kalau
  // dokter membuka ulang order yg sama utk koreksi), reuse endpoint yg
  // sama dgn ModalHasilRadiologi.tsx.
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/radiologi/permintaan/${encodeURIComponent(noorder)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail permintaan USG');
        setExams((data.pemeriksaan || []).map((e: ExamRow) => ({ kd_jenis_prw: e.kd_jenis_prw, nm_perawatan: e.nm_perawatan })));
        if (data.hasil_terakhir) {
          const p = parseHasilUsg(data.hasil_terakhir);
          setHasil(p.hasil);
          setKesan(p.kesan);
          setSaran(p.saran);
        }
        setSudahAdaHasil(!!data.sudah_ada_hasil);
        if (data.sudah_ada_hasil && data.petugas_nip_terakhir) {
          setPetugasNip(data.petugas_nip_terakhir);
          setPetugasQuery(data.petugas_nama_terakhir || data.petugas_nip_terakhir);
        } else {
          // Entri baru: Pengaturan > Mapping Petugas (usg) dulu, baru akun login.
          const p = await resolvePetugasDefault('usg', getCurrentUserNip());
          if (p) {
            setPetugasNip(p.nip);
            setPetugasQuery(p.nama);
          }
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
      } finally {
        setLoading(false);
      }
    })();
    const now = new Date();
    setTglPeriksa(todayStr());
    setJamPeriksa(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  }, [noorder]);

  // Foto USG dari Orthanc — SENGAJA cuma ditampilkan kalau search_mode
  // backend "accession_number" (studi ketemu PERSIS by AccessionNumber =
  // noorder, artinya benar dari mesin USG utk order ini). Kalau backend
  // fallback ke "patient_id" (AccessionNumber belum ketemu, cari longgar
  // by No.RM — lihat getDicomPreviewList/dicom_handler.go), foto TIDAK
  // ditampilkan sama sekali — itulah penyebab bug foto rontgen lama pasien
  // nyasar ke order USG baru yg dilaporkan user, dihindari di sini.
  // Foto bisa masuk SETELAH modal dibuka (mesin USG baru kirim gambar ke
  // Orthanc saat End Study) — jadi bisa dimuat ulang manual (tombol
  // "Muat Ulang") & dicek otomatis tiap 10 detik selama masih kosong.
  const loadFoto = React.useCallback(async (silent = false) => {
    if (!silent) setLoadingFoto(true);
    try {
      const res = await fetch(`/api/satu-sehat/dicom/preview-list/${encodeURIComponent(noorder)}`);
      const data = await res.json();
      if (res.ok && data.search_mode === 'accession_number') {
        setFoto({ instances: Array.isArray(data.instances) ? data.instances : [] });
      } else if (!silent) {
        setFoto({ instances: [] });
      }
    } catch {
      if (!silent) setFoto({ instances: [] });
    } finally {
      if (!silent) setLoadingFoto(false);
    }
  }, [noorder]);

  React.useEffect(() => { loadFoto(); }, [loadFoto]);

  React.useEffect(() => {
    if (loadingFoto || foto.instances.length > 0) return;
    const t = window.setInterval(() => loadFoto(true), 10000);
    return () => window.clearInterval(t);
  }, [loadFoto, loadingFoto, foto.instances.length]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(petugasQuery)}`);
      if (res.ok) setPetugasList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [petugasQuery]);

  // (Default petugas ditentukan di loader di atas — hasil tersimpan >
  // Mapping Petugas > akun login.)

  const handleSubmit = async () => {
    if (!petugasNip) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Petugas dulu' });
      return;
    }
    if (!patient.kd_dokter) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Dokter poliklinik pasien ini belum diketahui — periksa data kunjungan.' });
      return;
    }
    if (!hasil.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Isi Hasil Pemeriksaan dulu' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/radiologi/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noorder,
          no_rawat: patient.no_rawat,
          nip: petugasNip,
          kd_dokter: patient.kd_dokter,
          dokter_perujuk: patient.kd_dokter,
          pemeriksaan: exams.map((e) => ({ kd_jenis_prw: e.kd_jenis_prw })),
          hasil: composeHasilUsg(hasil, kesan, saran),
          tgl: otomatisJam ? '' : tglPeriksa,
          jam: otomatisJam ? '' : jamPeriksa,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan hasil pemeriksaan USG');

      // Foto USG dari Orthanc otomatis diupload ke gambar_radiologi (seksi
      // "Gambar Radiologi" di tab) — endpoint sama dgn tombol Upload per
      // foto di ModalHasilRadiologi.tsx; backend menempelkannya ke baris
      // hasil_radiologi TERBARU no_rawat ini = hasil yg baru disimpan.
      let fotoOk = 0;
      const fotoGagal: string[] = [];
      for (const inst of foto.instances) {
        try {
          const up = await fetch('/api/radiologi/upload-foto-orthanc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noorder, instance_id: inst.id }),
          });
          const upData = await up.json().catch(() => ({}));
          if (!up.ok) throw new Error(upData.error || 'Gagal upload foto');
          fotoOk++;
        } catch (e) {
          fotoGagal.push(e instanceof Error ? e.message : 'Gagal upload foto');
        }
      }
      // Jadikan template — best-effort: gagal TIDAK membatalkan hasil yg
      // sudah tersimpan, cukup dilaporkan.
      let templateGagal = '';
      if (jadikanTemplate) {
        try {
          const tr = await fetch('/api/radiologi/template-usg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kd_dokter: patient.kd_dokter, nama_template: namaTemplate.trim(), hasil, kesan, saran }),
          });
          const td = await tr.json().catch(() => ({}));
          if (!tr.ok) throw new Error(td.error || 'Gagal menyimpan template');
        } catch (e) {
          templateGagal = e instanceof Error ? e.message : 'Gagal menyimpan template';
        }
      }

      if (fotoGagal.length > 0 || templateGagal) {
        await Swal.fire({
          icon: 'warning',
          title: 'Hasil tersimpan',
          html: 'Hasil pemeriksaan USG tersimpan'
            + (fotoGagal.length > 0 ? `, tetapi ${fotoGagal.length} dari ${foto.instances.length} foto gagal diupload:<br/><small>${fotoGagal.join('<br/>')}</small>` : '.')
            + (templateGagal ? `<br/>Template gagal disimpan: <small>${templateGagal}</small>` : ''),
        });
      } else {
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: (fotoOk > 0 ? `Hasil pemeriksaan USG & ${fotoOk} foto berhasil disimpan` : 'Hasil pemeriksaan USG berhasil disimpan')
            + (jadikanTemplate ? ` — template "${namaTemplate.trim()}" dibuat` : ''),
          timer: 2000,
          showConfirmButton: false,
        });
      }
      onSaved();
      handleClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 30, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 4,
    fontSize: 12, boxSizing: 'border-box', outline: 'none',
  };
  const pillReadOnly: React.CSSProperties = { ...inputStyle, background: '#f3f4f6', color: '#374151' };
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxHeight: 200, overflowY: 'auto', zIndex: 1100, marginTop: 4,
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
        onClick={handleClose}
      >
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '50vw', maxWidth: '90vw',
            background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — breadcrumb pasien + close button bulat */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#000000', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span style={{ fontWeight: 600 }}>Input Hasil Pemeriksaan USG</span>
              {[patient?.no_rawat, patient?.no_rkm_medis, patient?.nm_pasien, patient?.umur]
                .filter(Boolean)
                .map((v, i) => (
                  <React.Fragment key={i}>
                    <span>|</span><span>{v}</span>
                  </React.Fragment>
                ))}
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
                background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0,
              }}
            >
              &times;
            </button>
          </div>

          {/* Body — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 16 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ marginTop: 12 }}>Memuat data...</p>
              </div>
            ) : (
              <>
                {/* Dokter P.J. (read-only, terkunci ke dokter poliklinik
                    pasien ini) langsung diikuti Petugas — field Dokter
                    Perujuk SENGAJA disembunyikan (tidak relevan ditampilkan
                    di alur USG Kandungan, dokter poliklinik yg periksa
                    sekaligus jadi perujuknya), tapi datanya TETAP dikirim
                    ke backend (dokter_perujuk = patient.kd_dokter) di
                    handleSubmit di bawah, cuma tidak ada input field-nya. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>Dokter Penanggung Jawab</label>
                    <input readOnly value={patient.nm_dokter || '-'} style={pillReadOnly} title="Otomatis dokter poliklinik pasien ini" />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
                      Petugas <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={petugasQuery}
                      onChange={(e) => { setPetugasQuery(e.target.value); setPetugasNip(''); setShowPetugasDropdown(true); }}
                      onFocus={() => setShowPetugasDropdown(true)}
                      onBlur={() => setTimeout(() => setShowPetugasDropdown(false), 200)}
                      placeholder="Cari nama petugas..."
                      style={inputStyle}
                    />
                    {showPetugasDropdown && petugasList.length > 0 && (
                      <div style={dropdownStyle}>
                        {petugasList.map((p, i) => (
                          <div
                            key={p.nip}
                            onClick={() => { setPetugasNip(p.nip); setPetugasQuery(p.nama); setShowPetugasDropdown(false); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: i < petugasList.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                          >{p.nama} ({p.nip})</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tanggal / Jam */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>Tanggal / Jam</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="date" disabled={otomatisJam} value={tglPeriksa} onChange={(e) => setTglPeriksa(e.target.value)} style={{ ...inputStyle, width: 160 }} />
                    <input type="time" disabled={otomatisJam} value={jamPeriksa} onChange={(e) => setJamPeriksa(e.target.value)} style={{ ...inputStyle, width: 90 }} />
                    <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={otomatisJam} onChange={(e) => setOtomatisJam(e.target.checked)} />
                      Otomatis
                    </label>
                  </div>
                </div>

                {/* Tabel Pemeriksaan disembunyikan (permintaan user) — data
                    exams tetap dimuat & dikirim saat Simpan. */}

                {/* Foto USG (kiri) + Hasil Pemeriksaan (kanan) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1, minHeight: 260 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#374151' }}>Foto USG (dari Orthanc)</span>
                      <button
                        type="button"
                        onClick={() => loadFoto()}
                        disabled={loadingFoto}
                        style={{ padding: '2px 8px', border: '1px solid #1AB1E5', background: '#fff', color: '#1AB1E5', borderRadius: 0, fontSize: 11, cursor: loadingFoto ? 'default' : 'pointer' }}
                      >
                        Muat Ulang
                      </button>
                    </div>
                    <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 4, padding: 10, overflowY: 'auto', background: '#000', minHeight: 240 }}>
                      {loadingFoto ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat dari Orthanc...</div>
                      ) : foto.instances.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Belum ada foto USG untuk pemeriksaan ini — dicek otomatis tiap 10 detik</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                          {foto.instances.map((inst) => {
                            const src = `/api/satu-sehat/dicom/preview-image/${inst.id}`;
                            return (
                              <div
                                key={inst.id}
                                onClick={() => setPreviewFoto(src)}
                                style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #374151', cursor: 'zoom-in' }}
                              >
                                <img
                                  src={src}
                                  alt={inst.modality || 'USG'}
                                  style={{ width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'contain', background: '#111827' }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => setShowTemplateModal(true)}
                        title="Pilih template hasil USG untuk mengisi form"
                        style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #1AB1E5', background: '#fff', color: '#1AB1E5', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line></svg>
                        Template
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#374151' }}>
                      Hasil Pemeriksaan <span style={{ color: '#ef4444' }}>*</span>
                    </span>
                    <textarea
                      value={hasil}
                      onChange={(e) => setHasil(e.target.value)}
                      placeholder="Tulis hasil bacaan/expertise USG..."
                      style={{ flex: 1, minHeight: 200, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#374151', marginTop: 6 }}>Kesimpulan/Kesan</span>
                    <textarea
                      value={kesan}
                      onChange={(e) => setKesan(e.target.value)}
                      placeholder="Tulis kesimpulan/kesan..."
                      style={{ minHeight: 70, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#374151', marginTop: 6 }}>Saran/Anjuran</span>
                    <textarea
                      value={saran}
                      onChange={(e) => setSaran(e.target.value)}
                      placeholder="Tulis saran/anjuran..."
                      style={{ minHeight: 70, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
                      {jadikanTemplate && (
                        <input
                          value={namaTemplate}
                          onChange={(e) => setNamaTemplate(e.target.value)}
                          placeholder="Nama template"
                          maxLength={100}
                          style={{ flex: 1, minWidth: 160, maxWidth: 280, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                        />
                      )}
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                        <input type="checkbox" checked={jadikanTemplate} onChange={(e) => setJadikanTemplate(e.target.checked)} />
                        Jadikan template
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer — sticky, tombol Simpan full-width */}
          <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handlePreviewPdf}
              disabled={previewingPdf || loading}
              title="Lihat PDF yang akan dikirim ke Peruri untuk TTE"
              style={{ padding: '12px 16px', borderRadius: 4, border: '1px solid #1AB1E5', background: '#fff', color: '#1AB1E5', cursor: (previewingPdf || loading) ? 'default' : 'pointer', fontSize: 14, fontWeight: 400, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              {previewingPdf ? 'Membuat PDF...' : 'Preview PDF'}
            </button>
            <button
              type="button"
              onClick={handleOtpUsg}
              disabled={tteBusy !== '' || loading}
              title="Minta OTP (perbarui sesi Peruri dokter)"
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', color: (tteBusy !== '' || loading) ? '#9ca3af' : '#374151', cursor: (tteBusy !== '' || loading) ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 15 15" fill="none">
                      <path d="M6 5.5H9M7.5 5.5V10M10.5 10V7.5M10.5 7.5V5.5H11.5C12.0523 5.5 12.5 5.94772 12.5 6.5C12.5 7.05228 12.0523 7.5 11.5 7.5H10.5ZM4.5 6.5V8.5C4.5 9.05228 4.05228 9.5 3.5 9.5C2.94772 9.5 2.5 9.05228 2.5 8.5V6.5C2.5 5.94772 2.94772 5.5 3.5 5.5C4.05228 5.5 4.5 5.94772 4.5 6.5ZM1.5 0.5H13.5C14.0523 0.5 14.5 0.947715 14.5 1.5V13.5C14.5 14.0523 14.0523 14.5 13.5 14.5H1.5C0.947716 14.5 0.5 14.0523 0.5 13.5V1.5C0.5 0.947716 0.947715 0.5 1.5 0.5Z" stroke="currentColor"/>
                    </svg>
            </button>
            <button
              type="button"
              onClick={handleUnduhUsg}
              disabled={tteBusy !== '' || loading || !lastTteOrderId}
              title="Unduh dokumen bertanda tangan (Peruri)"
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', color: (tteBusy !== '' || loading || !lastTteOrderId) ? '#9ca3af' : '#374151', cursor: (tteBusy !== '' || loading || !lastTteOrderId) ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.517 3.31h4.966v6.621h3.31L12 16.552 6.207 9.931h3.31V3.31zM0 19.034h24v1.655H0v-1.655z"/>
                    </svg>
            </button>
            <button
              type="button"
              onClick={handleTandaTanganUsg}
              disabled={tteBusy !== '' || loading}
              title="Tanda Tangan Elektronik (Peruri) — otomatis tersimpan ke Berkas Rawat"
              style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', color: (tteBusy !== '' || loading) ? '#9ca3af' : '#374151', cursor: (tteBusy !== '' || loading) ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="22" height="22" viewBox="0 1.5 14 11" fill="currentColor">
                      <path d="m 1.0324444,11.139308 c 0.0179,-0.1218 0.061,-0.2215 0.0958,-0.2215 0.0348,0 0.0633,-0.064 0.0633,-0.1428 0,-0.079 0.0321,-0.1428 0.0714,-0.1428 0.0393,0 0.0714,-0.064 0.0714,-0.1427 0,-0.079 0.0321,-0.1428 0.0714,-0.1428 0.0393,0 0.0714,-0.047 0.0714,-0.1045 0,-0.058 0.08,-0.2479001 0.17776,-0.4230001 0.12606,-0.2258 0.16557,-0.3794 0.13583,-0.528 -0.0254,-0.1269 0.002,-0.2942 0.0687,-0.4236 0.0608,-0.1177 0.18066,-0.4193 0.26627,-0.6702 0.0856,-0.251 0.17774,-0.4885 0.20472,-0.5277 0.027,-0.039 0.0925,-0.216 0.14571,-0.3927 0.0532,-0.1766 0.1232,-0.3517 0.15563,-0.389 0.0324,-0.037 0.059,-0.1417 0.059,-0.232 0,-0.09 0.0321,-0.1642 0.0714,-0.1642 0.0393,0 0.0714,-0.094 0.0714,-0.21 0,-0.1154 0.0321,-0.2298 0.0714,-0.254 0.0393,-0.024 0.073,-0.099 0.0749,-0.1649 0.002,-0.066 0.16547,-0.2492 0.36338,-0.4062 0.1979,-0.1571 0.43577,-0.3579 0.5286,-0.4462 0.0928,-0.088 0.1866,-0.1606 0.20838,-0.1606 0.0218,0 0.13637,-0.093 0.25466,-0.2056 0.11829,-0.113 0.3509,-0.2977 0.51691,-0.4104 0.16601,-0.1128 0.31254,-0.2291 0.32563,-0.2585 0.0131,-0.029 0.0683,-0.053 0.12276,-0.053 0.0544,0 0.21335,-0.064 0.35316,-0.1428 0.26925,-0.1512 0.60679,-0.1909 0.60679,-0.071 0,0.039 0.0421,0.071 0.0936,0.071 0.0515,0 0.15589,0.058 0.23201,0.1285 0.24872,0.231 0.37942,0.24 0.55068,0.038 0.30396,-0.3586 1.0957,-1.1308 1.25041,-1.2194 0.18638,-0.1068 0.51461,-0.1182 0.51461,-0.018 0,0.039 0.043,0.071 0.0956,0.071 0.12754,0 0.26131,0.3072 0.26131,0.6002 0,0.2369 -0.24982,0.6817 -0.50955,0.9073 -0.0731,0.063 -0.13294,0.139 -0.13294,0.1677 0,0.029 -0.0964,0.1422 -0.21416,0.2523 -0.23429,0.2188 -0.26247,0.3229 -0.12217,0.4512 0.18171,0.1662 0.89017,0.5482 1.01669,0.5482 0.0577,0 0.10491,0.029 0.10491,0.063 0,0.035 0.20949,0.1202 0.46554,0.1895 0.4572796,0.1237 0.4683696,0.1234 0.6246396,-0.018 0.1522,-0.1379 0.20395,-0.1411 1.19421,-0.074 0.56932,0.038 1.0438,0.078 1.05441,0.087 0.0106,0.01 0.0719,0.2706 0.13625,0.5806 0.22137,1.0669 0.1397,2.7256 -0.19548,3.9704001 l -0.0726,0.2698 -1.10376,0 -1.10375,0 0,-0.2142 c 0,-0.1178 -0.0321,-0.2142 -0.0714,-0.2142 -0.0393,0 -0.0714,-0.068 -0.0714,-0.1504 0,-0.1163 -0.0283,-0.1381 -0.12493,-0.096 -0.0687,0.03 -0.2373696,0.067 -0.3747896,0.083 -0.13742,0.016 -0.31799,0.063 -0.40128,0.1034 -0.15948,0.078 -0.59017,0.053 -1.4191,-0.084 -0.56756,-0.093 -0.48797,-0.091 -1.12627,-0.028 -0.26608,0.026 -0.50088,0.076 -0.52177,0.1096 -0.0539,0.087 -1.79571,0.078 -1.84994,-0.01 -0.0243,-0.039 -0.15276,-0.071 -0.28555,-0.071 -0.13279,0 -0.26128,-0.032 -0.28555,-0.071 -0.0243,-0.039 -0.15836,-0.071 -0.29798,-0.071 -0.20152,0 -0.30517,0.055 -0.50271,0.2677 -0.13687,0.1473 -0.29749,0.34 -0.35693,0.4284 -0.0594,0.088 -0.16674,0.1606 -0.23843,0.1606 -0.0717,0 -0.15021,0.032 -0.17447,0.071 -0.0243,0.039 -0.10154,0.071 -0.17172,0.071 -0.0702,0 -0.22087,0.046 -0.33487,0.1034 -0.11401,0.057 -0.33873,0.1244 -0.49939,0.1501 l -0.29211,0.047 0.0325,-0.2215 z m 0.83725,-0.2929 c 0.0243,-0.039 0.10648,-0.071 0.18268,-0.071 0.0762,0 0.13857,-0.032 0.13857,-0.071 0,-0.039 0.0482,-0.071 0.10708,-0.071 0.0589,0 0.10708,-0.048 0.10708,-0.1065 0,-0.1314 -0.28157,-0.4646 -0.39263,-0.4646 -0.11106,0 -0.39263,0.3332 -0.39263,0.4646 0,0.059 -0.0321,0.1065 -0.0714,0.1065 -0.0393,0 -0.0714,0.064 -0.0714,0.1428 0,0.1038 0.0476,0.1428 0.17426,0.1428 0.0958,0 0.19411,-0.032 0.21837,-0.071 z m 9.7914796,-0.4796 c 0.56959,-0.044 0.51279,0.02 0.6796,-0.7697001 0.10998,-0.5207 0.15529,-2.1091 0.0628,-2.2016 -0.0416,-0.042 -0.0756,-0.1661 -0.0756,-0.2766 0,-0.1106 -0.0399,-0.329 -0.0888,-0.4855 l -0.0888,-0.2844 -0.54608,0 c -0.62148,0 -0.64971,0.026 -0.55725,0.5046 0.11336,0.5873 0.075,1.9136 -0.0772,2.6663 -0.15299,0.7568001 -0.13618,1.0112001 0.0617,0.9332001 0.0652,-0.026 0.34848,-0.064 0.62959,-0.086 z M 6.1529444,9.9283079 c 0.15705,-0.042 0.48897,-0.1306 0.73759,-0.1971 0.4275,-0.1144 0.48566,-0.1141 1.07082,0.01 0.34032,0.07 0.81151,0.1273 1.04709,0.1279 0.50257,0.001 1.3830896,-0.1952 1.5309896,-0.3415 0.10718,-0.1061 0.23238,-0.8318 0.23976,-1.3898 0.005,-0.3722 -0.0687,-0.9074 -0.18342,-1.3327 -0.0786,-0.2915 -0.0876,-0.2983 -0.44116,-0.3348 -0.5742096,-0.059 -0.8963196,-0.1281 -0.8963196,-0.1915 0,-0.032 -0.0723,-0.082 -0.16062,-0.1096 -0.0883,-0.028 -0.36468,-0.1746 -0.61409,-0.326 -0.24941,-0.1514 -0.48231,-0.2753 -0.51756,-0.2753 -0.0352,0 -0.0641,-0.032 -0.0641,-0.071 0,-0.1875 -0.27918,-0.03 -0.65538,0.3706 -0.37178,0.3956 -0.41543,0.474 -0.41543,0.7454 0,0.1668 -0.0321,0.3232 -0.0714,0.3474 -0.0393,0.024 -0.0714,0.1069 -0.0714,0.1837 0,0.1551 -0.11414,0.3784 -0.30339,0.5936 -0.0687,0.078 -0.12493,0.1681 -0.12493,0.1999 0,0.1 0.34485,0.063 0.75135,-0.079 0.38822,-0.1364 0.39085,-0.1364 0.39085,0 0,0.078 -0.0993,0.2321 -0.22063,0.3429 l -0.22062,0.2015 -1.10194,0 c -0.7526,0 -1.12849,0.023 -1.18571,0.08 -0.0461,0.046 -0.17371,0.084 -0.28365,0.084 -0.10994,0 -0.19989,0.032 -0.19989,0.071 0,0.039 -0.0642,0.071 -0.14277,0.071 -0.0785,0 -0.14278,0.027 -0.14278,0.059 0,0.033 -0.0779,0.101 -0.17302,0.152 -0.18219,0.098 -0.28332,0.3465 -0.21403,0.5271 0.0461,0.1201 0.52553,0.3324 0.75054,0.3324 0.0805,0 0.19232,-0.046 0.24841,-0.1019 0.1151,-0.1151 0.14054,-0.6833 0.0306,-0.6833 -0.0393,0 -0.0714,-0.064 -0.0714,-0.1428 0,-0.1852 0.0407,-0.18 0.25311,0.033 0.12743,0.1274 0.17522,0.2528 0.17522,0.4598 0,0.1565 -0.0321,0.3044 -0.0714,0.3287 -0.13127,0.081 -0.0734,0.2215 0.12493,0.3028 0.22116,0.091 0.76798,0.071 1.19574,-0.043 z m -3.49888,-1.0793 c 0.20573,-0.3259 0.22956,-0.6039 0.0658,-0.7677 -0.0966,-0.097 -0.12355,-0.099 -0.1804,-0.013 -0.0368,0.055 -0.0861,0.1892 -0.10953,0.2971 -0.0235,0.108 -0.0656,0.1964 -0.0937,0.1964 -0.0642,0 -0.2167,0.3289 -0.2167,0.4673 0,0.063 0.0699,0.1038 0.17757,0.1038 0.12939,0 0.22625,-0.077 0.35694,-0.2842 z m 0.48514,0.048 c 0.26307,-0.271 0.4081,-0.5016 0.4081,-0.6489 0,-0.056 0.0241,-0.1128 0.0535,-0.1259 0.0294,-0.013 0.13385,-0.1992 0.23201,-0.4135 0.0982,-0.2144 0.31499,-0.5268 0.48186,-0.6942 0.16687,-0.1674 0.3034,-0.321 0.3034,-0.3412 0,-0.068 0.24679,-0.3411 1.08866,-1.2037 0.46134,-0.4727 0.8388,-0.888 0.8388,-0.9229 0,-0.1533 -0.39705,-0.4103 -0.63371,-0.4103 -0.16776,0 -0.63626,0.2586 -0.80241,0.443 -0.0635,0.071 -0.14859,0.1281 -0.18909,0.1281 -0.0405,0 -0.23766,0.1606 -0.43816,0.3569 -0.20049,0.1963 -0.3832,0.3569 -0.40602,0.3569 -0.0846,0 -0.78643,0.7789 -0.8785,0.9749 -0.0525,0.1117 -0.12374,0.2588 -0.15842,0.327 -0.0347,0.068 -0.0631,0.1726 -0.0631,0.232 0,0.059 -0.0321,0.1081 -0.0714,0.1081 -0.0393,0 -0.0714,0.094 -0.0714,0.2082 0,0.1145 -0.0388,0.2211 -0.0862,0.2369 -0.0576,0.019 -0.0357,0.083 0.0658,0.1919 0.22734,0.2441 0.34549,0.5655 0.24483,0.6662 -0.0449,0.045 -0.0817,0.1537 -0.0817,0.2417 0,0.088 -0.0321,0.1798 -0.0714,0.2041 -0.0732,0.045 -0.10182,0.3212 -0.0333,0.3212 0.0209,0 0.1414,-0.1064 0.2677,-0.2365 z m 2.72831,-1.0663 c 0.13638,-0.088 0.24836,-0.2008 0.24885,-0.2499 4.8e-4,-0.049 0.033,-0.089 0.0723,-0.089 0.0393,0 0.0714,-0.064 0.0714,-0.1428 0,-0.079 0.0321,-0.1427 0.0714,-0.1427 0.0393,0 0.0714,-0.08 0.0714,-0.1785 0,-0.2216 -0.0932,-0.2288 -0.23214,-0.018 -0.0582,0.088 -0.26617,0.3284 -0.4622,0.5335 -0.19602,0.2051 -0.3395,0.3899 -0.31884,0.4105 0.0753,0.075 0.23533,0.034 0.4779,-0.123 z"></path>
                    </svg>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || loading}
              style={{ flex: 1, padding: '12px 16px', borderRadius: 4, border: 'none', background: (saving || loading) ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: (saving || loading) ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
              onMouseOver={(e) => { if (!saving && !loading) e.currentTarget.style.background = '#0891B2'; }}
              onMouseOut={(e) => { if (!saving && !loading) e.currentTarget.style.background = '#1AB1E5'; }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Hasil Pemeriksaan USG'}
            </button>
          </div>
        </div>
      </div>

      {showTemplateModal && (
        <ModalTemplateUsg
          kdDokter={patient.kd_dokter || ''}
          onClose={() => setShowTemplateModal(false)}
          onPakai={async (t) => {
            if ((hasil.trim() || kesan.trim() || saran.trim())) {
              const ok = await Swal.fire({
                icon: 'question', title: 'Ganti isi form?', text: `Isi Hasil, Kesimpulan/Kesan & Saran/Anjuran akan diganti dengan template "${t.nama_template}".`,
                showCancelButton: true, confirmButtonText: 'Ganti', cancelButtonText: 'Batal', confirmButtonColor: '#1AB1E5',
              });
              if (!ok.isConfirmed) return;
            }
            setHasil(t.hasil); setKesan(t.kesan); setSaran(t.saran);
            setShowTemplateModal(false);
          }}
        />
      )}

      {/* Preview foto ukuran penuh — klik gambar mana pun di grid utk lihat */}
      {previewFoto && (
        <div
          onClick={(e) => { e.stopPropagation(); setPreviewFoto(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, cursor: 'zoom-out' }}
        >
          <img
            src={previewFoto}
            alt="Foto USG"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewFoto(null); }}
            style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </>
  );
};

// ─── Modal Template Hasil USG ────────────────────────────────────────────────
type TemplateUsg = { id: number; nama_template: string; hasil: string; kesan: string; saran: string };

const ModalTemplateUsg: React.FC<{ kdDokter: string; onClose: () => void; onPakai: (t: TemplateUsg) => void }> = ({ kdDokter, onClose, onPakai }) => {
  const [list, setList] = React.useState<TemplateUsg[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [cari, setCari] = React.useState('');

  const muat = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/radiologi/template-usg?kd_dokter=${encodeURIComponent(kdDokter)}`);
      const data = res.ok ? await res.json() : [];
      const arr: TemplateUsg[] = Array.isArray(data) ? data : [];
      setList(arr);
      setSelectedId((prev) => (prev && arr.some((x) => x.id === prev) ? prev : arr[0]?.id ?? null));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [kdDokter]);

  React.useEffect(() => { muat(); }, [muat]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tampil = list.filter((t) => !cari.trim() || t.nama_template.toLowerCase().includes(cari.trim().toLowerCase()));
  const selected = list.find((t) => t.id === selectedId) || null;

  const hapus = async (t: TemplateUsg) => {
    const ok = await Swal.fire({
      icon: 'warning', title: 'Hapus Template?', text: `Template "${t.nama_template}" akan dihapus.`,
      showCancelButton: true, confirmButtonText: 'Ya, Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#ef4444',
    });
    if (!ok.isConfirmed) return;
    const res = await fetch(`/api/radiologi/template-usg/${t.id}`, { method: 'DELETE' });
    if (!res.ok) { Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menghapus template' }); return; }
    muat();
  };

  const bagian = (judul: string, isi: string) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{judul}</div>
      <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{isi || '-'}</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 0, width: 'min(900px, 100%)', height: 'min(600px, calc(100vh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Template Hasil USG</span>
          <button type="button" onClick={onClose} title="Tutup" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: '#6b7280' }}>&times;</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari template..." style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Memuat...</div>
              ) : tampil.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  {list.length === 0 ? 'Belum ada template. Centang "Jadikan template" saat menyimpan hasil USG.' : 'Template tidak ditemukan'}
                </div>
              ) : tampil.map((t) => {
                const aktif = t.id === selectedId;
                return (
                  <div key={t.id} onClick={() => setSelectedId(t.id)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: aktif ? '#e0f2fe' : '#fff', borderLeft: aktif ? '3px solid #1AB1E5' : '3px solid transparent' }}>
                    <div style={{ fontSize: 13, color: '#111827', fontWeight: aktif ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nama_template}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{(t.kesan || t.hasil).split('\n')[0]}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {selected ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, color: '#111827' }}>{selected.nama_template}</div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
                  {bagian('Hasil Pemeriksaan', selected.hasil)}
                  {bagian('Kesimpulan/Kesan', selected.kesan)}
                  {bagian('Saran/Anjuran', selected.saran)}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => hapus(selected)} style={{ padding: '8px 14px', borderRadius: 4, border: '1px solid #ef4444', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Hapus</button>
                  <button type="button" onClick={() => onPakai(selected)} style={{ padding: '8px 14px', borderRadius: 4, border: '1px solid #1AB1E5', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Pakai</button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9ca3af' }}>Pilih template di sebelah kiri</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
