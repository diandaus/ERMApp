import React from 'react';
import Swal from 'sweetalert2';
import { LabTab } from '../components/LabTab';
import { RadTab } from '../components/RadTab';
import { TindakanTab } from '../components/TindakanTab';
import { DiagnosaTab } from '../components/DiagnosaTab';
import { ModalInputTriase } from '../components/ModalInputTriase';
import { ModalInputAwalMedisIGD } from '../components/ModalInputAwalMedisIGD';
import { SoapCpptFormIGD } from '../components/SoapCpptFormIGD';
import { RiwayatModal } from '../components/RiwayatModal';
import { renderTriasePrimer, renderTriaseSekunder } from '../utils/triaseIgdDisplay';
import { buildTriasePdfUntukTtd } from '../utils/triaseIgdPdf';
import { renderAwalMedisRecord } from '../utils/awalMedisIgdDisplay';
import { renderSoapCpptTable } from '../utils/soapCpptIgdDisplay';
import { useBreakpoint, useMediaQuery } from '../hooks/useBreakpoint';
import type { Patient as IGDPatient } from './IGDK';

// PemeriksaanIGD.tsx — layar pemeriksaan pasien IGD, dibuka dari IGDK.tsx
// (klik tombol No.Rawat pada baris pasien), ditampilkan fullscreen (overlay
// position:fixed, menutupi sidebar/header aplikasi — pola sama dgn ApotekView
// dari App.tsx case 'farmasi'). Kerangka tab mengikuti pola PemeriksaanRanap.tsx/Pemeriksaan.tsx (shell
// sidebar info pasien + tab bar + area konten), TAPI urutan & isi tab
// spesifik alur IGD:
//   Triase | Awal Medis | SOAP/CPPT | Awal Keperawatan | Laboratorium |
//   Radiologi | Tindakan | Diagnosa
//
// STATUS SAAT INI (dikerjakan bertahap per keputusan user):
// - Laboratorium/Radiologi/Tindakan/Diagnosa: SIAP, reuse komponen yang
//   sama dipakai Pemeriksaan.tsx (Poli) & PemeriksaanRanap.tsx — LabTab/
//   RadTab/TindakanTab/DiagnosaTab semuanya cuma butuh `patient.no_rawat`
//   tanpa filter status/kd_poli di backend, jadi otomatis jalan utk IGD
//   (TindakanTab dipanggil TANPA isRanap → default ke /api/tindakan-ralan,
//   sama seperti Poli; DiagnosaTab demikian juga menulis ke status='Ralan'
//   di diagnosa_pasien/prosedur_pasien — konsisten dgn cara kunjungan IGD
//   sudah diperlakukan flavor Ralan di seluruh backend, no_rawat IGD tetap
//   lewat reg_periksa/status_lanjut='Ralan').
// - Triase: SIAP — tombol "Input Triase" buka ModalInputTriase.tsx (form +
//   POST /api/triase-igd/simpan, persis alur RMTriaseIGD.java), lalu
//   TriaseDisplay (di bawah) menampilkan data tersimpan dgn konsumsi
//   GET /api/triase-igd/{no_rawat}, tabelnya (label : value, baris skala
//   berwarna sesuai kegawatan) dari utils/triaseIgdDisplay.tsx — tampilan
//   IDENTIK dgn RiwayatModal.tsx (renderTriasePrimer/renderTriaseSekunder)
//   tapi file terpisah berdiri sendiri, RiwayatModal.tsx TIDAK diubah.
//   Tombol "Riwayat Pasien" (sejajar, rata kanan dari "Input Triase")
//   membuka RiwayatModal.tsx apa adanya (fullscreen, tanpa modifikasi).
// - Awal Medis/SOAP/CPPT/Awal Keperawatan: PLACEHOLDER. Backend-nya baru
//   ada endpoint GET (read-only, dipakai RiwayatModal.tsx nampilin data
//   lama dari Khanza Desktop — lihat penilaian_medis_igd, penilaian_awal_
//   keperawatan_igd). Belum ada endpoint SIMPAN. Form-nya menyusul setelah
//   referensi Java DlgAsuhanMedis/DlgAsuhanKeperawatan (dan keputusan
//   skema tabel SOAP/CPPT IGD) siap.
// ============================================================================

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

type PemeriksaanIGDProps = {
  patient: IGDPatient;
  onBack: () => void;
  user?: AppUser;
};

const InfoItem: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  multiline?: boolean;
}> = ({ label, value, icon, highlight, multiline }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: multiline ? 'flex-start' : 'center' }}>
    {icon && (
      <div style={{ color: '#6b7280', display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: multiline ? 2 : 0 }}>
        {icon}
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: highlight ? '#1AB1E5' : '#111827', fontWeight: highlight ? 600 : 400, lineHeight: multiline ? 1.5 : 1.4, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  </div>
);

const TAB_LABELS: Record<TabKey, string> = {
  triase: 'TRIASE',
  medis: 'AWAL MEDIS',
  soap: 'SOAP/CPPT',
  keperawatan: 'AWAL KEPERAWATAN',
  lab: 'LABORATORIUM',
  rad: 'RADIOLOGI',
  tindakan: 'TINDAKAN',
  diagnosa: 'DIAGNOSA',
};

const TAB_ORDER: TabKey[] = ['triase', 'medis', 'soap', 'keperawatan', 'lab', 'rad', 'tindakan', 'diagnosa'];

type TabKey = 'triase' | 'medis' | 'soap' | 'keperawatan' | 'lab' | 'rad' | 'tindakan' | 'diagnosa';

const ComingSoon: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{title}</div>
    <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Fitur ini sedang dikembangkan dan akan segera hadir.</div>
  </div>
);

// ── Tampilan data Awal Medis IGD tersimpan (tab "Awal Medis") — konsumsi
// GET /api/asuhan-medis-igd/{no_rawat} (backend/asuhan_medis_handler.go,
// endpoint READ-ONLY, data lama dari Khanza Desktop — BELUM ada endpoint
// simpan/form input, itu langkah berikutnya). Render tabelnya (kop judul +
// seksi I-VI) dari utils/awalMedisIgdDisplay.tsx, persis pola TriaseDisplay
// (file terpisah berdiri sendiri, RiwayatModal.tsx tidak disentuh).
const AwalMedisDisplay: React.FC<{ noRawat: string; refreshKey: number }> = ({ noRawat, refreshKey }) => {
  const [list, setList] = React.useState<any[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/asuhan-medis-igd/${encodeURIComponent(noRawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [noRawat, refreshKey]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data awal medis...</div>;
  }

  if (!list || list.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data Awal Medis</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Penilaian awal medis pasien ini belum tersimpan.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {list.map((d, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
          {renderAwalMedisRecord(d)}
        </div>
      ))}
    </div>
  );
};

// PERURI_SIGNING_ERROR_MAP — duplikat persis dari ModalHasilRadiologi.tsx
// (tabel resultCode resmi API Signing Peruri), bukan diimpor — pola file-
// terpisah yg sama spt triaseIgdDisplay.tsx supaya modul Triase & Radiologi
// tetap decoupled walau logikanya identik.
const PERURI_SIGNING_ERROR_MAP: Record<string, string> = {
  '01': 'OTP tidak valid/gagal. Silakan klik "Minta OTP Ulang" lalu coba Tanda Tangan lagi.',
  '02': 'Expired key.',
  '03': 'Dokumen sudah kadaluarsa atau sudah pernah ditandatangani. Coba ulangi dari awal (klik Tanda Tangan lagi).',
  '4001': 'Sertifikat elektronik penandatangan ini belum tersedia di Peruri. Cek status via tombol "Sertifikat" di Bridging > Peruri > Data Pengguna.',
  '4003': 'Worker Peruri belum tersedia. Coba lagi beberapa saat.',
  '4004': 'Worker Peruri sedang bermasalah. Coba lagi beberapa saat.',
  '4005': 'Spesimen tanda tangan tidak ditemukan — penandatangan kemungkinan belum submit spesimen tanda tangan ke Peruri.',
  '4006': 'Gagal mengambil data spesimen tanda tangan dari Peruri.',
  '4007': 'Gagal menambahkan visibility penandatangan.',
  '4008': 'Gagal mengubah visibility penandatangan.',
  '4009': 'File dokumen tidak ditemukan di Peruri.',
  '4012': 'Gagal melakukan proses penandatanganan di server Peruri.',
  '4014': 'Koordinat posisi tanda tangan tidak ditemukan di dokumen oleh Peruri.',
  '4015': 'Gagal generate Peruri Tera (stample tanda tangan).',
  '4017': 'Gagal generate kode QR tanda tangan.',
  '4026': 'Gagal memvalidasi token dan OTP. Silakan klik "Minta OTP Ulang" lalu coba Tanda Tangan lagi.',
};

// showProcessing/hideProcessing/showOtpDialog/peruriPost — duplikat pola
// ModalHasilRadiologi.tsx (lihat backend/PERURI_TTE_DOKUMENTASI.md §9,
// "Reuse pola UI"), dipakai bersama handleTandaTangan/handleMintaOtpUlang
// di bawah.
const showProcessing = (html: string) => {
  Swal.fire({ html, allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
};
const hideProcessing = () => Swal.close();

const showOtpDialog = async (email: string, onResend: () => Promise<void>, confirmButtonText: string): Promise<string | undefined> => {
  const { value: otpCode } = await Swal.fire({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin-bottom:14px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
        </div>
        <div style="font-size:19px;font-weight:700;color:#111827;margin-bottom:6px;">Masukkan Kode OTP</div>
        <div style="font-size:13px;color:#6b7280;line-height:1.5;">Kode verifikasi sudah dikirim ke<br/><b style="color:#111827;">${email}</b></div>
      </div>
    `,
    input: 'text',
    inputAttributes: { maxlength: '6', inputmode: 'numeric', autocomplete: 'one-time-code' },
    showCancelButton: false,
    showCloseButton: true,
    confirmButtonText,
    confirmButtonColor: '#2563eb',
    inputValidator: (value) => (!value ? 'Kode OTP wajib diisi' : undefined),
    didOpen: (popup) => {
      const input = popup.querySelector('.swal2-input') as HTMLInputElement | null;
      if (input) {
        input.placeholder = '6 digit kode OTP';
        Object.assign(input.style, { textAlign: 'center', fontSize: '22px', fontWeight: '700', letterSpacing: '8px', maxWidth: '220px', margin: '4px auto 6px', borderRadius: '10px' });
      }
      const confirmBtn = popup.querySelector('.swal2-confirm') as HTMLButtonElement | null;
      if (confirmBtn) Object.assign(confirmBtn.style, { width: '85%', margin: '10px auto 0', borderRadius: '8px', fontWeight: '700' });

      const resendWrap = document.createElement('div');
      resendWrap.style.cssText = 'text-align:center;font-size:12.5px;color:#6b7280;margin-top:4px;';
      resendWrap.innerHTML = 'Tidak menerima kode? <button id="btnResendOtpDialogTriase" type="button" style="background:none;border:none;color:#2563eb;font-weight:600;font-size:12.5px;cursor:pointer;text-decoration:underline;padding:0;">Kirim ulang</button>';
      input?.insertAdjacentElement('afterend', resendWrap);

      const resendBtn = resendWrap.querySelector('#btnResendOtpDialogTriase') as HTMLButtonElement | null;
      resendBtn?.addEventListener('click', async () => {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Mengirim ulang...';
        try {
          await onResend();
          resendBtn.textContent = 'Kode baru terkirim';
        } catch (err) {
          resendBtn.textContent = err instanceof Error ? err.message : 'Gagal kirim ulang';
        } finally {
          window.setTimeout(() => { resendBtn.disabled = false; resendBtn.textContent = 'Kirim ulang'; }, 3000);
        }
      });
    },
  });
  return otpCode as string | undefined;
};

const peruriPost = async (path: string, body: unknown): Promise<any> => {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Gagal memanggil ${path}`);
  const upstream = data.response;
  if (upstream && typeof upstream === 'object' && 'resultCode' in upstream && upstream.resultCode !== '0') {
    throw new Error(`[${upstream.resultCode}] ${upstream.resultDesc || `${path} gagal`}`);
  }
  return upstream;
};

// getSignerEmail — lookup email penandatangan via GET /api/pegawai/:nik/email
// (fallback petugas -> dokter -> pegawai, lihat backend/pegawai_email_handler.go)
// — BEDA dari ModalHasilRadiologi.tsx yg selalu dokter (GET /api/dokter/:kd/email),
// krn "Dokter/Petugas IGD" di Triase bisa perawat/petugas biasa, bukan selalu dokter.
const getSignerEmail = async (nik: string, namaFallback: string): Promise<{ email: string; nama: string }> => {
  if (!nik) throw new Error('Dokter/Petugas IGD belum diisi pada data triase ini.');
  const res = await fetch(`/api/pegawai/${encodeURIComponent(nik)}/email`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Data penandatangan tidak ditemukan.');
  const nama = data.nama || namaFallback || nik;
  if (!data.email) {
    throw new Error(`Email untuk ${nama} belum diisi. Hubungi admin untuk menambahkan email di data petugas/dokter.`);
  }
  return { email: data.email as string, nama };
};

// useTriaseTte — hook yg menampung fetch data triase + seluruh state/
// handler TTE Peruri (Preview/OTP/Download/Tanda Tangan). Diekstrak dari
// TriaseDisplay jadi hook TERPISAH (dipanggil SEKALI di PemeriksaanIGDView,
// bukan di dalam TriaseDisplay) supaya tombol "Input Triase" (dimiliki &
// TIDAK dipindah dari PemeriksaanIGDView) & 4 tombol aksi dokumen bisa
// ditaruh SEBARIS di satu container flex row yg sama — kalau hook ini
// dipanggil di dalam TriaseDisplay, tombol Input Triase harus ikut pindah
// ke situ juga (yg TIDAK diinginkan user).
const useTriaseTte = (noRawat: string, refreshKey: number, patient: IGDPatient) => {
  const [data, setData] = React.useState<{ triase_primer?: any; triase_sekunder?: any } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [previewing, setPreviewing] = React.useState<'primer' | 'sekunder' | null>(null);
  const [signingJenis, setSigningJenis] = React.useState<'primer' | 'sekunder' | null>(null);
  const [requestingOtpJenis, setRequestingOtpJenis] = React.useState<'primer' | 'sekunder' | null>(null);
  const [downloadingJenis, setDownloadingJenis] = React.useState<'primer' | 'sekunder' | null>(null);
  const [lastTteOrderId, setLastTteOrderId] = React.useState<Record<'primer' | 'sekunder', string | null>>({ primer: null, sekunder: null });

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/triase-igd/${encodeURIComponent(noRawat)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [noRawat, refreshKey]);

  // handlePreview — buka PDF yg AKAN dikirim ke Peruri (buildTriasePdfUntukTtd)
  // di tab baru TANPA mengirim apa pun ke Peruri, persis pola handlePreviewTtd
  // di ModalHasilRadiologi.tsx.
  const handlePreview = async (jenis: 'primer' | 'sekunder', jenisData: any) => {
    setPreviewing(jenis);
    try {
      const { pdfBytes } = await buildTriasePdfUntukTtd(jenis, jenisData, patient);
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setPreviewing(null);
    }
  };

  // handleTandaTangan — alur Digital Signature Peruri lengkap (Send
  // Document -> [skip-OTP kalau sesi masih aktif] Get OTP -> Validate OTP
  // -> Signing), PERSIS pola handleTandaTangan di ModalHasilRadiologi.tsx
  // (lihat backend/PERURI_TTE_DOKUMENTASI.md §1). PDF & signBox dari
  // buildTriasePdfUntukTtd (SATU sumber, sama byte yg dipreview lewat
  // handlePreview) — email penandatangan dicari terpisah via getSignerEmail
  // (bukan bagian dari buildTriasePdfUntukTtd, krn Preview tidak butuh email).
  const handleTandaTangan = async (jenis: 'primer' | 'sekunder', jenisData: any) => {
    setSigningJenis(jenis);
    showProcessing('Menyiapkan & mengirim dokumen ke Peruri, mohon tunggu...');
    try {
      const { pdfBytes, signBox, nikPetugas, namaPetugas } = await buildTriasePdfUntukTtd(jenis, jenisData, patient);
      const { email, nama } = await getSignerEmail(nikPetugas, namaPetugas);

      const form = new FormData();
      const filePrefix = jenis === 'primer' ? 'TriasePrimer' : 'TriaseSekunder';
      form.append('file', new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), `${filePrefix}_${noRawat.replace(/\//g, '_')}.pdf`);
      form.append('email', email);
      form.append('isVisualSign', 'YES');
      form.append('lowerLeftX', String(signBox.lowerLeftX));
      form.append('lowerLeftY', String(signBox.lowerLeftY));
      form.append('upperRightX', String(signBox.upperRightX));
      form.append('upperRightY', String(signBox.upperRightY));
      form.append('page', signBox.page);
      form.append('certificateLevel', 'NOT_CERTIFIED');
      form.append('varLocation', 'Sigli');
      form.append('varReason', 'Signed');
      form.append('teraImage', 'QR-DETECSI');
      form.append('orderType', 'INDIVIDUAL');

      const sendRes = await fetch('/api/peruri/send-document-tmp', { method: 'POST', body: form });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error || 'Gagal mengirim dokumen ke Peruri');
      if (sendData.response && typeof sendData.response === 'object' && 'resultCode' in sendData.response && sendData.response.resultCode !== '0') {
        throw new Error(`[${sendData.response.resultCode}] ${sendData.response.resultDesc || 'Send Document gagal'}`);
      }
      const orderId = sendData?.response?.data?.orderId || sendData?.response?.orderId;
      if (!orderId) throw new Error('Peruri tidak mengembalikan orderId: ' + JSON.stringify(sendData.response));

      showProcessing(`Dokumen berhasil terkirim ke Peruri.<br/>Order ID: <b>${orderId}</b><br/><span style="font-size:12px;color:#6b7280;">Melanjutkan proses tanda tangan...</span>`);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      const sessionRes = await fetch(`/api/peruri/session-status?email=${encodeURIComponent(email)}`);
      const sessionData = await sessionRes.json().catch(() => ({ valid: false }));
      let sesiDipakaiUlang = false;

      if (sessionRes.ok && sessionData.valid) {
        sesiDipakaiUlang = true;
      } else {
        const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
        let tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
        if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

        hideProcessing();
        const otpCode = await showOtpDialog(email, async () => {
          const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
          const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
          if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
          tokenSession = newTokenSession;
        }, 'Verifikasi & Tanda Tangan');
        if (!otpCode) return;

        showProcessing('Memverifikasi OTP & menandatangani dokumen, mohon tunggu...');
        await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
      }

      if (sesiDipakaiUlang) showProcessing('Sesi OTP masih aktif, menandatangani dokumen, mohon tunggu...');
      try {
        await peruriPost('/api/peruri/signing', { orderId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        const codeMatch = msg.match(/^\[([^\]]+)\]/);
        const code = codeMatch?.[1];
        if (code && code in PERURI_SIGNING_ERROR_MAP) {
          throw new Error(`[${code}] ${PERURI_SIGNING_ERROR_MAP[code]}`);
        }
        if (/otp|session|expired/i.test(msg)) {
          throw new Error('Masa berlaku sesi OTP sudah habis di sisi Peruri. Silakan klik tombol "Minta OTP Ulang" terlebih dahulu, lalu coba Tanda Tangan lagi.');
        }
        throw err;
      }
      hideProcessing();
      setLastTteOrderId((prev) => ({ ...prev, [jenis]: orderId }));

      await Swal.fire({
        icon: 'success', title: 'Berhasil ditandatangani',
        html: `Dokumen berhasil ditandatangani oleh <b>${nama}</b> (${email}).<br/>Order ID: <b>${orderId}</b>`
          + (sesiDipakaiUlang ? '<br/><small>(Sesi OTP masih aktif, tidak perlu OTP ulang)</small>' : ''),
      });
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSigningJenis(null);
    }
  };

  // handleMintaOtpUlang — persis pola ModalHasilRadiologi.tsx, dipakai
  // dokter/petugas utk memperbarui/memvalidasi ulang sesi OTP SEBELUM
  // benar2 menandatangani (mis. sesi lama sudah/hampir expired).
  const handleMintaOtpUlang = async (jenis: 'primer' | 'sekunder', jenisData: any) => {
    setRequestingOtpJenis(jenis);
    showProcessing('Mengirim kode OTP, mohon tunggu...');
    try {
      const { email } = await getSignerEmail(jenisData?.nik, jenisData?.nama);

      const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
      let tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
      if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

      hideProcessing();
      const otpCode = await showOtpDialog(email, async () => {
        const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
        const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
        if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
        tokenSession = newTokenSession;
      }, 'Verifikasi');
      if (!otpCode) return;

      showProcessing('Memverifikasi OTP, mohon tunggu...');
      await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
      hideProcessing();

      await Swal.fire({ icon: 'success', title: 'Sesi OTP diperbarui', html: `Sesi OTP untuk <b>${email}</b> berhasil divalidasi ulang dan aktif selama 24 jam ke depan.` });
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setRequestingOtpJenis(null);
    }
  };

  // handleDownloadDokumen — ambil dokumen yg SUDAH ditandatangani dari
  // Peruri & auto-upload ke berkasrawat (prefix "TriasePrimer_"/
  // "TriaseSekunder_" dikirim ke backend, lihat downloadPeruriDocument di
  // peruri_handler.go — beda dari Radiologi yg hardcode "Radiologi_").
  const handleDownloadDokumen = async (jenis: 'primer' | 'sekunder') => {
    const orderId = lastTteOrderId[jenis];
    if (!orderId) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Belum ada dokumen yang ditandatangani di sesi ini. Lakukan Tanda Tangan dulu.' });
      return;
    }
    setDownloadingJenis(jenis);
    showProcessing('Mengunduh dokumen dari Peruri, mohon tunggu...');
    try {
      const filePrefix = jenis === 'primer' ? 'TriasePrimer_' : 'TriaseSekunder_';
      const res = await fetch('/api/peruri/download-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, no_rawat: noRawat, prefix: filePrefix }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal mengunduh dokumen');
      const upstream = resData.response;
      if (upstream && typeof upstream === 'object' && 'resultCode' in upstream && upstream.resultCode !== '0') {
        throw new Error(`[${upstream.resultCode}] ${upstream.resultDesc || 'Download Document gagal'}`);
      }
      const dataResp = upstream?.data || upstream || {};
      const base64Doc: string | undefined = dataResp.base64Document || dataResp.document || dataResp.file || dataResp.base64;
      if (!base64Doc) {
        hideProcessing();
        Swal.fire({
          icon: 'warning', title: 'Format respons tidak dikenali',
          html: `Peruri tidak mengembalikan field dokumen yg dikenali. Response mentah:<br/><pre style="text-align:left;font-size:11px;white-space:pre-wrap;">${JSON.stringify(upstream, null, 2)}</pre>`,
        });
        return;
      }
      const byteChars = atob(base64Doc);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TTE_${filePrefix}${noRawat.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      hideProcessing();
      if (resData.uploaded_to_berkasrawat) {
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Dokumen terunduh & otomatis terupload ke Berkas Rawat.', timer: 2000, showConfirmButton: false });
      }
    } catch (err) {
      hideProcessing();
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setDownloadingJenis(null);
    }
  };

  const previewButtonStyle: React.CSSProperties = { height: 30, padding: '0 12px', borderRadius: 0, border: '1px solid #1AB1E5', background: '#fff', color: '#1AB1E5', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, boxSizing: 'border-box' };
  const iconButtonStyle = (disabled: boolean): React.CSSProperties => ({ width: 30, height: 30, borderRadius: 0, border: '1px solid #d1d5db', background: '#fff', color: disabled ? '#9ca3af' : '#374151', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' });

  // Primer/Sekunder saling eksklusif dlm praktiknya (lihat komentar
  // triaseIgdDisplay.tsx) — dokumen yg ADA (primer diprioritaskan kalau by
  // kondisi langka keduanya terisi) yg 4 tombol aksinya ditaruh sebaris dgn
  // Input Triase; dokumen lainnya (kondisi langka) tetap pakai baris sendiri.
  const headerJenis: 'primer' | 'sekunder' | null = data?.triase_primer ? 'primer' : data?.triase_sekunder ? 'sekunder' : null;

  // renderActionButtons — grup 4 tombol aksi dokumen (OTP/Download/TTD/
  // Preview) utk satu jenis (primer/sekunder), diekstrak jadi fungsi supaya
  // bisa dipakai baik di header (sebaris dgn Input Triase, kasus normal)
  // maupun di baris sendiri per-dokumen (fallback kasus langka dua-duanya
  // ada sekaligus).
  const renderActionButtons = (jenis: 'primer' | 'sekunder', jenisData: any) => (
    <React.Fragment>
      <button
        type="button" onClick={() => handleMintaOtpUlang(jenis, jenisData)} disabled={requestingOtpJenis === jenis}
        title="Minta OTP Ulang (perbarui sesi Peruri)" style={iconButtonStyle(requestingOtpJenis === jenis)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M6 5.5H9M7.5 5.5V10M10.5 10V7.5M10.5 7.5V5.5H11.5C12.0523 5.5 12.5 5.94772 12.5 6.5C12.5 7.05228 12.0523 7.5 11.5 7.5H10.5ZM4.5 6.5V8.5C4.5 9.05228 4.05228 9.5 3.5 9.5C2.94772 9.5 2.5 9.05228 2.5 8.5V6.5C2.5 5.94772 2.94772 5.5 3.5 5.5C4.05228 5.5 4.5 5.94772 4.5 6.5ZM1.5 0.5H13.5C14.0523 0.5 14.5 0.947715 14.5 1.5V13.5C14.5 14.0523 14.0523 14.5 13.5 14.5H1.5C0.947716 14.5 0.5 14.0523 0.5 13.5V1.5C0.5 0.947716 0.947715 0.5 1.5 0.5Z" stroke="currentColor"/>
        </svg>
      </button>
      <button
        type="button" onClick={() => handleDownloadDokumen(jenis)} disabled={downloadingJenis === jenis || !lastTteOrderId[jenis]}
        title={lastTteOrderId[jenis] ? 'Download Dokumen Tertandatangani (Peruri)' : 'Belum ada dokumen tertandatangani di sesi ini'}
        style={iconButtonStyle(downloadingJenis === jenis || !lastTteOrderId[jenis])}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.517 3.31h4.966v6.621h3.31L12 16.552 6.207 9.931h3.31V3.31zM0 19.034h24v1.655H0v-1.655z"/>
        </svg>
      </button>
      <button
        type="button" onClick={() => handleTandaTangan(jenis, jenisData)} disabled={signingJenis === jenis}
        title="Tanda Tangan Elektronik (Peruri)" style={{ ...iconButtonStyle(signingJenis === jenis), width: 'auto', padding: '0 12px', gap: 6, fontSize: 12, fontWeight: 500, border: '1px solid #1AB1E5', color: signingJenis === jenis ? '#9ca3af' : '#1AB1E5' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
        {signingJenis === jenis ? 'Memproses...' : 'Tanda Tangan'}
      </button>
      <button type="button" onClick={() => handlePreview(jenis, jenisData)} disabled={previewing === jenis} style={previewButtonStyle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
        {previewing === jenis ? 'Membuka...' : 'Preview Dokumen'}
      </button>
    </React.Fragment>
  );

  return { data, loading, headerJenis, renderActionButtons };
};

// ── Tampilan data Triase tersimpan (tab "Triase", di bawah tombol Input
// Triase) — komponen PRESENTASIONAL murni, konsumsi data/handler dari
// useTriaseTte (dipanggil sekali di PemeriksaanIGDView, BUKAN di sini —
// supaya tombol Input Triase, yg dimiliki PemeriksaanIGDView, bisa sebaris
// dgn 4 tombol aksi dokumen tanpa duplikasi/pindah kepemilikan). Render
// tabelnya (label : value, baris skala berwarna) dipakai dari
// utils/triaseIgdDisplay.tsx — SENGAJA file terpisah berdiri sendiri
// (bukan reuse langsung dari RiwayatModal.tsx) supaya RiwayatModal.tsx
// tidak ikut berubah/diotak-atik sama sekali; tapi tampilannya tetap
// identik sama seperti histori Khanza Desktop.
const TriaseDisplay: React.FC<{
  data: { triase_primer?: any; triase_sekunder?: any } | null;
  loading: boolean;
  headerJenis: 'primer' | 'sekunder' | null;
  renderActionButtons: (jenis: 'primer' | 'sekunder', jenisData: any) => React.ReactNode;
}> = ({ data, loading, headerJenis, renderActionButtons }) => {
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data triase...</div>;
  }

  if (!data?.triase_primer && !data?.triase_sekunder) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data Triase</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Klik &quot;Input Triase&quot; untuk memulai penilaian triase pasien ini.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.triase_primer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {headerJenis !== 'primer' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
              {renderActionButtons('primer', data.triase_primer)}
            </div>
          )}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
            {renderTriasePrimer(data.triase_primer)}
          </div>
        </div>
      )}
      {data.triase_sekunder && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {headerJenis !== 'sekunder' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
              {renderActionButtons('sekunder', data.triase_sekunder)}
            </div>
          )}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
            {renderTriaseSekunder(data.triase_sekunder)}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Panel kanan (40%) tab Triase — Riwayat SOAPIE Terakhir (TANPA judul
// di kartunya, per keputusan user). Konsumsi endpoint yang sama dipakai
// RiwayatSoapieModal.tsx (Pemeriksaan.tsx Poli): GET /api/pemeriksaan/
// riwayat-soapie/{no_rkm_medis}?filter=last5 — registrasi sudah terurut
// DESC (tgl_registrasi), soapie per registrasi ASC (tgl_perawatan/
// jam_rawat), jadi item TERAKHIR pada registrasi PERTAMA yg punya data =
// SOAPIE paling baru lintas kunjungan.
type SoapieLatestItem = {
  tgl_perawatan: string; jam_rawat: string;
  suhu_tubuh: string; tensi: string; nadi: string; respirasi: string; tinggi: string; berat: string;
  gcs: string; spo2: string; kesadaran: string; lingkar_perut: string;
  keluhan: string; pemeriksaan: string; alergi: string;
  penilaian: string; rtl: string; instruksi: string; evaluasi: string;
  nip: string; nama: string; jbtn: string;
};
type SoapieRegistration = { no_reg: string; no_rawat: string; tgl_registrasi: string; status_lanjut: string; soapie: SoapieLatestItem[] };

const formatTglSoapie = (tgl?: string) => {
  if (!tgl) return '-';
  const d = tgl.split('T')[0];
  const [y, m, day] = d.split('-');
  return d && y && m && day ? `${day}/${m}/${y}` : '-';
};

const SoapieVitalChip: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div style={{ padding: '5px 8px', borderRadius: 0, background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: 11.5 }}>
      <span style={{ color: '#6b7280' }}>{label}: </span>
      <span style={{ color: '#111827' }}>{value}</span>
    </div>
  );
};

const SoapieRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
};

const RiwayatSoapieTerakhir: React.FC<{ noRkmMedis: string; onOpenRiwayat: () => void }> = ({ noRkmMedis, onOpenRiwayat }) => {
  const [item, setItem] = React.useState<SoapieLatestItem | null>(null);
  const [noRawat, setNoRawat] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!noRkmMedis) return;
    setLoading(true);
    fetch(`/api/pemeriksaan/riwayat-soapie/${encodeURIComponent(noRkmMedis)}?filter=last5`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SoapieRegistration[]) => {
        const list = Array.isArray(data) ? data : [];
        const reg = list.find((r) => r.soapie && r.soapie.length > 0);
        if (reg) {
          setItem(reg.soapie[reg.soapie.length - 1]);
          setNoRawat(reg.no_rawat);
        } else {
          setItem(null);
        }
      })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [noRkmMedis]);

  return (
    <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onOpenRiwayat}
          style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#000', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#262626'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#000'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
          </svg>
          Riwayat Pasien
        </button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 16 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat...</div>
        ) : !item ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '48px 16px', color: '#9ca3af' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
            <div style={{ fontSize: 12.5, textAlign: 'center' }}>Belum ada riwayat SOAPIE</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, color: '#111827' }}>Riwayat Kunjungan Terakhir</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{noRawat}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12, color: '#6b7280' }}>
              <span>Petugas: <span style={{ color: '#111827' }}>{item.nama || '-'}</span>{item.jbtn ? ` (${item.jbtn})` : ''}</span>
              <span style={{ flexShrink: 0 }}>{formatTglSoapie(item.tgl_perawatan)} | {(item.jam_rawat || '').slice(0, 5)}</span>
            </div>

            <SoapieRow label="Subjek (Keluhan)" value={item.keluhan} />
            <SoapieRow label="Objek (Pemeriksaan)" value={item.pemeriksaan} />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <SoapieVitalChip label="Tensi" value={item.tensi} />
              <SoapieVitalChip label="Nadi" value={item.nadi} />
              <SoapieVitalChip label="Respirasi" value={item.respirasi} />
              <SoapieVitalChip label="Suhu" value={item.suhu_tubuh} />
              <SoapieVitalChip label="SpO2" value={item.spo2} />
              <SoapieVitalChip label="GCS" value={item.gcs} />
              <SoapieVitalChip label="Kesadaran" value={item.kesadaran} />
              {item.alergi && <SoapieVitalChip label="Alergi" value={item.alergi} />}
            </div>

            <SoapieRow label="Asesmen" value={item.penilaian} />
            <SoapieRow label="Plan" value={item.rtl} />
            <SoapieRow label="Inst/Impl" value={item.instruksi} />
            <SoapieRow label="Evaluasi" value={item.evaluasi} />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Tampilan data SOAP/CPPT tersimpan (tab "SOAP/CPPT") — konsumsi GET
// /api/pemeriksaan-ralan/{no_rawat} (endpoint GENERIK yg sudah ada, SAMA
// dipakai RiwayatModal.tsx — beda dari GET /api/pemeriksaan/soap-history/
// {no_rawat} yg dipakai SoapCpptFormIGD.tsx krn endpoint itu tidak join
// nama/jbtn petugas). Render tabelnya (Tanggal | Dokter/Paramedis |
// Profesi/Jabatan/Departemen, dst) dari utils/soapCpptIgdDisplay.tsx —
// DUPLIKAT PERSIS renderPemeriksaanTable di RiwayatModal.tsx (file
// terpisah berdiri sendiri, pola sama dgn triaseIgdDisplay.tsx/
// awalMedisIgdDisplay.tsx), per permintaan user "SOAP yang tersimpan
// tampil dengan model tabel [screenshot referensi]".
type SoapRalanItem = {
  tgl_perawatan: string; jam_rawat: string;
  suhu_tubuh: string; tensi: string; nadi: string; respirasi: string; tinggi: string; berat: string;
  spo2: string; gcs: string; kesadaran: string;
  keluhan: string; pemeriksaan: string; alergi: string; lingkar_perut: string;
  rtl: string; penilaian: string; instruksi: string; evaluasi: string; nip: string; nama: string; jbtn: string;
};

const SoapCpptDisplay: React.FC<{ noRawat: string; refreshKey: number }> = ({ noRawat, refreshKey }) => {
  const [list, setList] = React.useState<SoapRalanItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/pemeriksaan-ralan/${encodeURIComponent(noRawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [noRawat, refreshKey]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat data SOAP/CPPT...</div>;
  }

  if (!list || list.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data SOAP/CPPT</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Catatan perkembangan pasien ini belum tersimpan.</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
      {renderSoapCpptTable(list)}
    </div>
  );
};

export const PemeriksaanIGDView: React.FC<PemeriksaanIGDProps> = ({ patient, onBack, user }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('triase');
  const [showPatientInfo, setShowPatientInfo] = React.useState(false);
  const [showInputTriase, setShowInputTriase] = React.useState(false);
  const [triaseRefreshKey, setTriaseRefreshKey] = React.useState(0);
  const [showInputAwalMedis, setShowInputAwalMedis] = React.useState(false);
  const [awalMedisRefreshKey, setAwalMedisRefreshKey] = React.useState(0);
  const [soapCpptRefreshKey, setSoapCpptRefreshKey] = React.useState(0);
  const [showRiwayatModal, setShowRiwayatModal] = React.useState(false);
  const triaseTte = useTriaseTte(patient.no_rawat, triaseRefreshKey, patient);
  const { isCompact } = useBreakpoint();
  void isCompact;
  // Sidebar info pasien permanen di layar >=1366px (laptop/desktop umum),
  // jadi overlay drawer di bawah itu — pola sama dgn PemeriksaanRanap.tsx.
  const isPermanentSidebar = !useMediaQuery(1365);

  const tabStyle = (tab: TabKey): React.CSSProperties => ({
    padding: '10px 20px', border: 'none',
    background: activeTab === tab ? '#e0f2fe' : 'transparent',
    borderBottom: activeTab === tab ? '3px solid #1AB1E5' : '3px solid transparent',
    color: activeTab === tab ? '#1AB1E5' : '#6b7280',
    cursor: 'pointer', fontSize: 13,
    fontWeight: 400,
    transition: 'all 0.2s',
    whiteSpace: 'nowrap', flexShrink: 0,
  });

  const formatTgl = (tgl?: string) => {
    if (!tgl || tgl === '0000-00-00') return '-';
    const d = tgl.split('T')[0];
    const [y, m, day] = d.split('-');
    return d ? `${day}/${m}/${y}` : '-';
  };

  return (
    <section style={{ background: '#f3f4f6', borderRadius: 0, padding: 0, height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>

      {/* Overlay drawer info pasien — hanya di bawah 1366px */}
      {!isPermanentSidebar && showPatientInfo && (
        <div
          onClick={() => setShowPatientInfo(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }}
        />
      )}

      {/* Sidebar — permanen di >=1366px, drawer di bawah itu */}
      <aside style={{
        width: 280, background: '#ffffff', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'auto', overscrollBehavior: 'none',
        ...(isPermanentSidebar
          ? { position: 'sticky' as const, top: 0, height: '100vh' }
          : {
              position: 'fixed' as const,
              top: 0, left: 0, height: '100vh', zIndex: 95,
              boxShadow: '2px 0 16px rgba(0,0,0,0.2)',
              transform: showPatientInfo ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.25s ease'
            })
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px', background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>Informasi Pasien</h3>
            <div style={{ fontSize: 10, color: '#0891B2', background: '#fff', padding: '4px 10px', borderRadius: 12, fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              {patient.png_jawab || 'UMUM'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="white" />
                <path d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z" fill="white" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.nm_pasien}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{patient.no_rkm_medis}</div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, background: '#f9fafb' }}>

          {/* Identitas */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #1AB1E5 0%, #0891B2 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Identitas Diri</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem
                label="Jenis Kelamin"
                value={`${patient.jk === 'L' ? 'Laki-laki' : patient.jk === 'P' ? 'Perempuan' : patient.jk || '-'}${patient.umur ? ` (${patient.umur})` : ''}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20" /></svg>} />
              <InfoItem label="Alamat Penanggung Jawab" value={patient.almt_pj || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>}
                multiline />
              {patient.no_tlp && (
                <InfoItem label="No. Telepon" value={patient.no_tlp}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>} />
              )}
            </div>
          </div>

          {/* Kunjungan IGD */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Kunjungan IGD</h4>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoItem label="No. Rawat" value={patient.no_rawat}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
                highlight />
              <InfoItem label="Tanggal & Jam Masuk" value={`${formatTgl(patient.tgl_registrasi)}${patient.jam_reg ? ` • ${patient.jam_reg}` : ''}`}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} />
              <InfoItem label="Dokter" value={patient.nm_dokter || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} />
              <InfoItem label="Cara Bayar" value={patient.png_jawab || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>} />
              <InfoItem label="Status" value={patient.stts || '-'}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 52, boxSizing: 'border-box', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {!isPermanentSidebar && (
              <button
                type="button"
                onClick={() => setShowPatientInfo(true)}
                title="Info Pasien"
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{patient.nm_pasien}</span>
              </button>
            )}
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pemeriksaan IGD</h3>
          </div>
          <button
            onClick={onBack}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #1AB1E5', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
          >
            Kembali
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '0 24px', borderBottom: '2px solid #e5e7eb', background: '#fff', flexShrink: 0, overflowX: 'auto', overscrollBehaviorX: 'contain' }}>
          {TAB_ORDER.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#f9fafb', overscrollBehavior: 'none' }}>
          <div style={{ padding: '24px 20px' }}>
            {activeTab === 'triase' && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setShowInputTriase(true)}
                      style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Input Triase
                    </button>
                    {triaseTte.headerJenis && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {triaseTte.renderActionButtons(
                          triaseTte.headerJenis,
                          triaseTte.headerJenis === 'primer' ? triaseTte.data?.triase_primer : triaseTte.data?.triase_sekunder,
                        )}
                      </div>
                    )}
                  </div>
                  <TriaseDisplay data={triaseTte.data} loading={triaseTte.loading} headerJenis={triaseTte.headerJenis} renderActionButtons={triaseTte.renderActionButtons} />
                </div>

                <RiwayatSoapieTerakhir noRkmMedis={patient.no_rkm_medis} onOpenRiwayat={() => setShowRiwayatModal(true)} />
              </div>
            )}
            {activeTab === 'medis' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowInputAwalMedis(true)}
                    style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Input Awal Medis
                  </button>
                </div>
                <AwalMedisDisplay noRawat={patient.no_rawat} refreshKey={awalMedisRefreshKey} />
              </div>
            )}
            {activeTab === 'soap' && (
              <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SoapCpptFormIGD patient={patient} user={user} onSaved={() => setSoapCpptRefreshKey((k) => k + 1)} />
                <SoapCpptDisplay noRawat={patient.no_rawat} refreshKey={soapCpptRefreshKey} />
              </div>
            )}
            {activeTab === 'keperawatan' && <ComingSoon title="Awal Keperawatan" />}
            {activeTab === 'lab' && <LabTab patient={patient} />}
            {activeTab === 'rad' && <RadTab patient={patient} />}
            {activeTab === 'tindakan' && <TindakanTab patient={patient} />}
            {activeTab === 'diagnosa' && <DiagnosaTab patient={patient} />}
          </div>
        </div>
      </div>

      <ModalInputTriase
        isOpen={showInputTriase}
        onClose={() => setShowInputTriase(false)}
        patient={patient}
        user={user}
        onSuccess={() => setTriaseRefreshKey((k) => k + 1)}
      />

      <ModalInputAwalMedisIGD
        isOpen={showInputAwalMedis}
        onClose={() => setShowInputAwalMedis(false)}
        patient={patient}
        user={user}
        onSuccess={() => setAwalMedisRefreshKey((k) => k + 1)}
      />

      {showRiwayatModal && (
        <RiwayatModal patient={patient} onClose={() => setShowRiwayatModal(false)} />
      )}
    </section>
  );
};
