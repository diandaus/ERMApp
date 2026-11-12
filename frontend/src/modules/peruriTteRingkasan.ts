import Swal from 'sweetalert2';
import { buildDokumenPasienPdf } from './peruriDokumenPasienPdf';
import { getCurrentUserNip } from '../utils/currentUser';

// peruriTteRingkasan.ts — alur TTE Peruri utk "Ringkasan Perawatan Pasien"
// dari submenu Peruri "Lihat Dokumen / Perlu Diproses". Langkah & pesan
// error PERSIS alur handleTandaTangan / handleDownloadDokumen di
// ModalHasilLabPK.tsx (yg sudah jalan di production):
//   Send Document (+SIGN_BOX dari tag "#A#") → tracking "Belum"
//   → sesi OTP masih aktif (24 jam)? kalau tidak: Get OTP → input → Validate
//   → Signing → tracking "Sudah".
// Satu dokumen per pasien PER DOKTER (pasien ranap dgn >1 DPJP bisa
// ditandatangani masing2 DPJP) — lihat namaDokumenRingkasan.

export type RingkasanTarget = {
  no_rawat: string;
  kd_dokter: string;
  nm_dokter: string;
  nm_pasien: string;
};

// HARUS sama persis dgn namaDok di backend/peruri_perlu_diproses_handler.go.
export const namaDokumenRingkasan = (t: Pick<RingkasanTarget, 'no_rawat' | 'kd_dokter'>) =>
  `Ringkasan_Perawatan_${t.no_rawat.replace(/\//g, '')}_${t.kd_dokter}.pdf`;

const PERURI_SIGNING_ERROR_MAP: Record<string, string> = {
  '01': 'OTP tidak valid/gagal. Silakan klik Tanda Tangan lagi dan masukkan OTP baru.',
  '02': 'Expired key.',
  '03': 'Dokumen sudah kadaluarsa atau sudah pernah ditandatangani. Coba ulangi dari awal (klik Tanda Tangan lagi).',
  '4001': 'Sertifikat elektronik dokter ini belum tersedia di Peruri. Cek status via tombol "Sertifikat" di Bridging > Peruri > Data Pengguna.',
  '4003': 'Worker Peruri belum tersedia. Coba lagi beberapa saat.',
  '4004': 'Worker Peruri sedang bermasalah. Coba lagi beberapa saat.',
  '4005': 'Spesimen tanda tangan tidak ditemukan — dokter kemungkinan belum submit spesimen tanda tangan ke Peruri.',
  '4006': 'Gagal mengambil data spesimen tanda tangan dari Peruri.',
  '4007': 'Gagal menambahkan visibility penandatangan.',
  '4008': 'Gagal mengubah visibility penandatangan.',
  '4009': 'File dokumen tidak ditemukan di Peruri.',
  '4012': 'Gagal melakukan proses penandatanganan di server Peruri.',
  '4014': 'Koordinat posisi tanda tangan tidak ditemukan di dokumen oleh Peruri.',
  '4015': 'Gagal generate Peruri Tera (stample tanda tangan).',
  '4017': 'Gagal generate kode QR tanda tangan.',
  '4026': 'Gagal memvalidasi token dan OTP. Silakan klik Tanda Tangan lagi dan masukkan OTP baru.',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const showProcessing = (html: string) => {
  Swal.fire({ html, allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
};
const hideProcessing = () => Swal.close();

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

const showOtpDialog = async (email: string, onResend: () => Promise<void>): Promise<string | undefined> => {
  const { value: otpCode } = await Swal.fire({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;margin-bottom:14px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path></svg>
        </div>
        <div style="font-size:19px;font-weight:700;color:#111827;margin-bottom:6px;">Masukkan Kode OTP</div>
        <div style="font-size:13px;color:#6b7280;line-height:1.5;">Kode verifikasi sudah dikirim ke<br/><b style="color:#111827;">${escapeHtml(email)}</b></div>
      </div>
    `,
    input: 'text',
    inputAttributes: { maxlength: '6', inputmode: 'numeric', autocomplete: 'one-time-code' },
    showCancelButton: false,
    showCloseButton: true,
    confirmButtonText: 'Verifikasi & Tanda Tangan',
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
      resendWrap.innerHTML = 'Tidak menerima kode? <button id="btnResendOtpRingkasan" type="button" style="background:none;border:none;color:#2563eb;font-weight:600;font-size:12.5px;cursor:pointer;text-decoration:underline;padding:0;">Kirim ulang</button>';
      input?.insertAdjacentElement('afterend', resendWrap);
      const resendBtn = resendWrap.querySelector('#btnResendOtpRingkasan') as HTMLButtonElement | null;
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

const getEmailDokter = async (t: RingkasanTarget): Promise<string> => {
  const res = await fetch(`/api/dokter/${encodeURIComponent(t.kd_dokter)}/email`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Data dokter tidak ditemukan');
  if (!data.email) {
    throw new Error(`Email dokter penanggung jawab (${t.nm_dokter || data.nm_dokter || t.kd_dokter}) belum diisi. Hubungi admin untuk menambahkan email di data dokter.`);
  }
  return data.email as string;
};

// pastikanSesiOtp — sesi OTP Peruri berlaku 24 jam per email dokter
// (tracking_tte_session). Masih aktif → langsung lanjut; kalau tidak →
// Get OTP + dialog input + Validate. SATU OTP ini dipakai utk semua
// dokumen berikutnya (signingSession cukup kirim orderId — Peruri sendiri
// yg mengaitkan sesi dgn email). 'batal' = user menutup dialog OTP.
// tokenSession OTP yg SUDAH diminta tapi belum berhasil divalidasi, per
// email dokter. Disimpan supaya tombol "OTP" di header dokter bisa membuka
// dialog lagi & memvalidasi KODE YG SUDAH TERKIRIM (mis. dokter salah
// ketik) tanpa meminta OTP baru. sessionStorage → tetap ada setelah reload.
const OTP_PENDING_KEY = 'peruri.otpPending';
const bacaOtpPending = (): Record<string, string> => {
  try { return JSON.parse(sessionStorage.getItem(OTP_PENDING_KEY) || '{}') || {}; } catch { return {}; }
};
const simpanOtpPending = (email: string, token: string | null) => {
  try {
    const m = bacaOtpPending();
    if (token) m[email] = token; else delete m[email];
    sessionStorage.setItem(OTP_PENDING_KEY, JSON.stringify(m));
  } catch { /* abaikan */ }
};

// Dialog OTP + Validate memakai tokenSession yg ada. Tombol "kirim ulang"
// di dialog tetap meminta OTP baru (token pending ikut diganti). Gagal
// validasi → token TETAP disimpan supaya bisa dicoba lagi lewat tombol OTP.
async function inputDanValidasiOtp(email: string, tokenAwal: string): Promise<'baru' | 'batal'> {
  let tokenSession = tokenAwal;
  simpanOtpPending(email, tokenSession);
  hideProcessing();
  const otpCode = await showOtpDialog(email, async () => {
    const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
    const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
    if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
    tokenSession = newTokenSession;
    simpanOtpPending(email, tokenSession);
  });
  if (!otpCode) return 'batal';

  showProcessing('Memverifikasi OTP, mohon tunggu...');
  await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
  simpanOtpPending(email, null);
  return 'baru';
}

async function pastikanSesiOtp(email: string): Promise<'aktif' | 'baru' | 'batal'> {
  const sessionRes = await fetch(`/api/peruri/session-status?email=${encodeURIComponent(email)}`);
  const sessionData = await sessionRes.json().catch(() => ({ valid: false }));
  if (sessionRes.ok && sessionData.valid) return 'aktif';

  const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
  const tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
  if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));
  return inputDanValidasiOtp(email, tokenSession);
}

// Error yg berarti sesi OTP tidak berlaku lagi — di mode massal, dokumen
// berikutnya PASTI ikut gagal, jadi proses dihentikan.
const isErrorSesi = (msg: string) => /^\[(01|4026)\]/.test(msg) || /sesi otp|otp|session|expired/i.test(msg);

// kirimDanTandaTangan — 1 dokumen: buat PDF → Send Document → tracking
// "Belum" → Signing → tracking "Sudah". TANPA dialog (dipakai mode satuan
// & massal); gagal → throw Error dgn pesan yg sudah diterjemahkan.
async function kirimDanTandaTangan(t: RingkasanTarget, email: string): Promise<string> {
  const { pdfBytes, signBox } = await buildDokumenPasienPdf(t.no_rawat, { namaPengesah: t.nm_dokter });
  const namaDokumen = namaDokumenRingkasan(t);

  const form = new FormData();
  form.append('file', new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), namaDokumen);
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
  const sendData = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) throw new Error(sendData.error || 'Gagal mengirim dokumen ke Peruri');
  if (sendData.response && typeof sendData.response === 'object' && 'resultCode' in sendData.response && sendData.response.resultCode !== '0') {
    throw new Error(`[${sendData.response.resultCode}] ${sendData.response.resultDesc || 'Send Document gagal'}`);
  }
  const orderId = sendData?.response?.data?.orderId || sendData?.response?.orderId;
  if (!orderId) throw new Error('Peruri tidak mengembalikan orderId: ' + JSON.stringify(sendData.response));

  // Catat ke tracking_dokumen_ttd (status "Belum") — best-effort, sama dgn
  // modal Lab. Baris inilah yg dibaca kolom Status TTE di Perlu Diproses.
  try {
    await fetch('/api/peruri/tracking/kirim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ no_rawat: t.no_rawat, nama_dokumen: namaDokumen, order_id: orderId, user_pengirim: getCurrentUserNip(), email_ttd: email }),
    });
  } catch { /* non-blocking */ }

  try {
    await peruriPost('/api/peruri/signing', { orderId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const code = msg.match(/^\[([^\]]+)\]/)?.[1];
    if (code && code in PERURI_SIGNING_ERROR_MAP) throw new Error(`[${code}] ${PERURI_SIGNING_ERROR_MAP[code]}`);
    if (/otp|session|expired/i.test(msg)) {
      throw new Error('Masa berlaku sesi OTP sudah habis di sisi Peruri. Silakan klik Tanda Tangan lagi untuk meminta OTP baru.');
    }
    throw err;
  }

  try {
    await fetch('/api/peruri/tracking/sukses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch { /* non-blocking */ }
  return String(orderId);
}

// inputUlangOtp — tombol "OTP" di header grup dokter (Perlu Diproses):
// masukkan ULANG kode OTP yg SUDAH terkirim ke email dokter (mis. salah
// ketik), memakai tokenSession yg tersimpan — TIDAK meminta OTP baru.
export async function inputUlangOtp(dokter: Pick<RingkasanTarget, 'kd_dokter' | 'nm_dokter'>): Promise<boolean> {
  showProcessing('Memeriksa OTP, mohon tunggu...');
  try {
    const email = await getEmailDokter(dokter as RingkasanTarget);
    const token = bacaOtpPending()[email];
    if (!token) {
      hideProcessing();
      await Swal.fire({
        icon: 'info', title: 'Belum ada OTP',
        html: `Belum ada OTP yang menunggu dimasukkan untuk <b>${escapeHtml(dokter.nm_dokter)}</b>.<br/>Klik <b>Tanda Tangan</b> pada salah satu pasien untuk meminta OTP.`,
      });
      return false;
    }
    const sesi = await inputDanValidasiOtp(email, token);
    hideProcessing();
    if (sesi === 'batal') return false;
    await Swal.fire({
      icon: 'success', title: 'OTP berhasil diverifikasi',
      html: `Sesi tanda tangan <b>${escapeHtml(dokter.nm_dokter)}</b> (${escapeHtml(email)}) aktif selama 24 jam.`,
    });
    return true;
  } catch (err) {
    hideProcessing();
    Swal.fire({ icon: 'error', title: 'OTP gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    return false;
  }
}

// tandaTanganRingkasan — 1 dokumen. Balikin true kalau berhasil (caller lalu
// menandai baris jadi "Sudah"), false kalau batal/gagal (error sudah
// ditampilkan ke user di sini).
export async function tandaTanganRingkasan(t: RingkasanTarget): Promise<boolean> {
  const konfirmasi = await Swal.fire({
    icon: 'question',
    title: 'Tanda Tangan Dokumen?',
    html: `Ringkasan Perawatan <b>${escapeHtml(t.nm_pasien)}</b> (${escapeHtml(t.no_rawat)})<br/>akan dikirim ke Peruri dan ditandatangani oleh <b>${escapeHtml(t.nm_dokter)}</b>.`,
    showCancelButton: true,
    confirmButtonText: 'Lanjutkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#059669',
  });
  if (!konfirmasi.isConfirmed) return false;

  showProcessing('Memeriksa sesi tanda tangan, mohon tunggu...');
  try {
    const email = await getEmailDokter(t);
    const sesi = await pastikanSesiOtp(email);
    if (sesi === 'batal') return false;

    showProcessing(sesi === 'aktif'
      ? 'Sesi OTP masih aktif, mengirim & menandatangani dokumen, mohon tunggu...'
      : 'Mengirim & menandatangani dokumen, mohon tunggu...');
    const orderId = await kirimDanTandaTangan(t, email);
    hideProcessing();

    await Swal.fire({
      icon: 'success', title: 'Berhasil ditandatangani',
      html: `Ringkasan Perawatan berhasil ditandatangani oleh <b>${escapeHtml(t.nm_dokter)}</b> (${escapeHtml(email)}).<br/>Order ID: <b>${escapeHtml(orderId)}</b>`
        + (sesi === 'aktif' ? '<br/><small>(Sesi OTP masih aktif, tidak perlu OTP ulang)</small>' : ''),
    });
    return true;
  } catch (err) {
    hideProcessing();
    Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    return false;
  }
}

// tandaTanganRingkasanMassal — banyak dokumen milik SATU dokter, 1x klik &
// paling banyak 1x OTP: sesi OTP dipastikan dulu, lalu tiap dokumen dikirim
// & ditandatangani BERURUTAN (1 per 1). Dokumen yg gagal dilewati & dicatat
// alasannya; kalau error-nya soal sesi OTP, sisa dokumen dihentikan (pasti
// ikut gagal). onBerhasil dipanggil per dokumen sukses → baris langsung
// berubah "Sudah" di layar tanpa menunggu semua selesai.
export async function tandaTanganRingkasanMassal(targets: RingkasanTarget[], onBerhasil: (t: RingkasanTarget) => void): Promise<void> {
  if (targets.length === 0) return;
  const dokter = targets[0];
  if (targets.some((t) => t.kd_dokter !== dokter.kd_dokter)) {
    Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Tanda tangan massal hanya bisa untuk dokumen milik satu dokter yang sama.' });
    return;
  }

  const konfirmasi = await Swal.fire({
    icon: 'question',
    title: `Tanda Tangan ${targets.length} Dokumen?`,
    html: `<b>${targets.length}</b> Ringkasan Perawatan akan dikirim ke Peruri dan ditandatangani oleh <b>${escapeHtml(dokter.nm_dokter)}</b>.<br/><small style="color:#6b7280;">Cukup 1x OTP untuk semua dokumen.</small>`,
    showCancelButton: true,
    confirmButtonText: 'Lanjutkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#059669',
  });
  if (!konfirmasi.isConfirmed) return;

  showProcessing('Memeriksa sesi tanda tangan, mohon tunggu...');
  let email: string;
  try {
    email = await getEmailDokter(dokter);
    if ((await pastikanSesiOtp(email)) === 'batal') return;
  } catch (err) {
    hideProcessing();
    Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    return;
  }

  let berhasil = 0;
  const gagal: { t: RingkasanTarget; alasan: string }[] = [];
  let dihentikan = 0;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    showProcessing(`Menandatangani dokumen <b>${i + 1}</b> dari <b>${targets.length}</b><br/>${escapeHtml(t.nm_pasien)} <span style="color:#6b7280;">(${escapeHtml(t.no_rawat)})</span>`
      + `<br/><span style="font-size:12px;color:#6b7280;">Berhasil: ${berhasil} · Gagal: ${gagal.length}</span>`);
    try {
      await kirimDanTandaTangan(t, email);
      berhasil++;
      onBerhasil(t);
    } catch (err) {
      const alasan = err instanceof Error ? err.message : 'Terjadi kesalahan';
      gagal.push({ t, alasan });
      if (isErrorSesi(alasan)) {
        dihentikan = targets.length - i - 1;
        break;
      }
    }
  }
  hideProcessing();

  const daftarGagal = gagal.map((g) => `<li><b>${escapeHtml(g.t.nm_pasien)}</b> (${escapeHtml(g.t.no_rawat)}): ${escapeHtml(g.alasan)}</li>`).join('');
  await Swal.fire({
    icon: gagal.length === 0 ? 'success' : berhasil === 0 ? 'error' : 'warning',
    title: gagal.length === 0 ? 'Semua dokumen berhasil ditandatangani' : 'Selesai dengan catatan',
    html: `<div style="text-align:left;font-size:13.5px;">
        <div>Berhasil: <b style="color:#059669;">${berhasil}</b> dari ${targets.length} dokumen</div>
        ${gagal.length ? `<div style="margin-top:6px;">Gagal: <b style="color:#dc2626;">${gagal.length}</b></div><ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;max-height:180px;overflow:auto;">${daftarGagal}</ul>` : ''}
        ${dihentikan ? `<div style="margin-top:8px;color:#92400e;">${dihentikan} dokumen sisanya tidak diproses karena sesi OTP berakhir. Klik Tanda Tangan Terpilih lagi untuk melanjutkan dengan OTP baru.</div>` : ''}
      </div>`,
    confirmButtonColor: '#059669',
  });
}

type OpsiSimpanBerkas = { no_rawat: string; no_order: string; prefix: string };

// ambilDokumenTte — inti unduh 1 dokumen TANPA dialog: ambil dari Peruri
// (download-document) → simpan ke komputer user → backend sekalian
// upload ke Berkas Rawat kalau simpanKeBerkas diisi. Gagal ambil → throw;
// gagal upload → TIDAK throw (dokumen tetap terunduh), dilaporkan lewat
// uploadError supaya caller bisa menampilkannya.
async function ambilDokumenTte(orderId: string, namaFile: string, simpanKeBerkas?: OpsiSimpanBerkas): Promise<{ uploaded: boolean; uploadError: string }> {
  const res = await fetch('/api/peruri/download-document', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, ...(simpanKeBerkas || {}) }),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(resData.error || `Gagal mengunduh dokumen (HTTP ${res.status})`);
  const upstream = resData.response;
  if (upstream && typeof upstream === 'object' && 'resultCode' in upstream && upstream.resultCode !== '0') {
    throw new Error(`[${upstream.resultCode}] ${upstream.resultDesc || 'Download Document gagal'}`);
  }
  const data = upstream?.data || upstream || {};
  const base64Doc: string | undefined = data.base64Document || data.document || data.file || data.base64;
  if (!base64Doc) throw new Error('Peruri tidak mengembalikan isi dokumen yang dikenali.');

  const byteChars = atob(base64Doc);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `TTE_${namaFile}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke ditunda: di mode massal klik unduh beruntun, revoke langsung
  // bisa membatalkan unduhan yg belum sempat dimulai browser.
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);

  return { uploaded: !!resData.uploaded_to_berkasrawat, uploadError: resData.upload_error || '' };
}

// unduhDokumenTte — 1 dokumen, dgn dialog proses & hasil (dipakai tombol
// Unduh per baris di Selesai dan unduhRingkasanTte). simpanKeBerkas diisi →
// sekalian upload ke Berkas Rawat; kosong → hanya diunduh.
export async function unduhDokumenTte(orderId: string, namaFile: string, simpanKeBerkas?: OpsiSimpanBerkas): Promise<void> {
  showProcessing('Mengunduh dokumen dari Peruri, mohon tunggu...');
  try {
    const { uploaded, uploadError } = await ambilDokumenTte(orderId, namaFile, simpanKeBerkas);
    hideProcessing();
    if (!simpanKeBerkas) {
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Dokumen bertanda tangan berhasil diunduh.', timer: 1800, showConfirmButton: false });
    } else if (uploaded) {
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Dokumen terunduh & otomatis tersimpan ke Berkas Rawat.', timer: 2000, showConfirmButton: false });
    } else {
      Swal.fire({
        icon: 'warning', title: 'Simpan ke Berkas Rawat gagal',
        text: `Dokumen berhasil diunduh ke komputer, tapi GAGAL otomatis tersimpan ke Berkas Rawat${uploadError ? `: ${uploadError}` : '.'}`,
      });
    }
  } catch (err) {
    hideProcessing();
    Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }
}

// unduhDokumenTteMassal — banyak dokumen, 1x klik: diproses BERURUTAN 1 per
// 1 (ambil dari Peruri → unduh ke komputer → upload ke Berkas Rawat utk yg
// punya simpanKeBerkas). Yg gagal dilewati, dirangkum di akhir.
export type ItemUnduh = { orderId: string; namaFile: string; label: string; simpanKeBerkas?: OpsiSimpanBerkas };
export async function unduhDokumenTteMassal(items: ItemUnduh[]): Promise<void> {
  if (items.length === 0) return;
  const konfirmasi = await Swal.fire({
    icon: 'question',
    title: `Unduh ${items.length} Dokumen?`,
    html: `<b>${items.length}</b> dokumen bertanda tangan akan diunduh satu per satu dari Peruri.`
      + (items.some((it) => it.simpanKeBerkas) ? '<br/><small style="color:#6b7280;">Ringkasan Perawatan sekalian disimpan ke Berkas Rawat.</small>' : '')
      + '<br/><small style="color:#6b7280;">Kalau browser menanyakan izin mengunduh banyak file, pilih <b>Izinkan</b>.</small>',
    showCancelButton: true,
    confirmButtonText: 'Lanjutkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#059669',
  });
  if (!konfirmasi.isConfirmed) return;

  let berhasil = 0;
  const gagal: { label: string; alasan: string }[] = [];
  const gagalUpload: { label: string; alasan: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    showProcessing(`Mengunduh dokumen <b>${i + 1}</b> dari <b>${items.length}</b><br/>${escapeHtml(it.label)}`
      + `<br/><span style="font-size:12px;color:#6b7280;">Berhasil: ${berhasil} · Gagal: ${gagal.length}</span>`);
    try {
      const { uploaded, uploadError } = await ambilDokumenTte(it.orderId, it.namaFile, it.simpanKeBerkas);
      berhasil++;
      if (it.simpanKeBerkas && !uploaded) gagalUpload.push({ label: it.label, alasan: uploadError || 'tidak diketahui' });
      // Jeda singkat antar unduhan supaya browser tidak menggabung/menolak
      // klik unduh beruntun.
      await new Promise((r) => window.setTimeout(r, 400));
    } catch (err) {
      gagal.push({ label: it.label, alasan: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  }
  hideProcessing();

  const li = (xs: { label: string; alasan: string }[]) => xs.map((x) => `<li><b>${escapeHtml(x.label)}</b>: ${escapeHtml(x.alasan)}</li>`).join('');
  await Swal.fire({
    icon: gagal.length === 0 && gagalUpload.length === 0 ? 'success' : berhasil === 0 ? 'error' : 'warning',
    title: gagal.length === 0 && gagalUpload.length === 0 ? 'Semua dokumen berhasil diunduh' : 'Selesai dengan catatan',
    html: `<div style="text-align:left;font-size:13.5px;">
        <div>Berhasil diunduh: <b style="color:#059669;">${berhasil}</b> dari ${items.length} dokumen</div>
        ${gagal.length ? `<div style="margin-top:6px;">Gagal diunduh: <b style="color:#dc2626;">${gagal.length}</b></div><ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;max-height:150px;overflow:auto;">${li(gagal)}</ul>` : ''}
        ${gagalUpload.length ? `<div style="margin-top:6px;">Terunduh tapi gagal disimpan ke Berkas Rawat: <b style="color:#92400e;">${gagalUpload.length}</b></div><ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;max-height:150px;overflow:auto;">${li(gagalUpload)}</ul>` : ''}
      </div>`,
    confirmButtonColor: '#059669',
  });
}

// opsiSimpanRingkasan — nama file di Berkas Rawat utk Ringkasan Perawatan:
// RiwayatPerawatan_<no_rawat, "/"→"_">_signed.pdf
// (mis. RiwayatPerawatan_2026_11_09_000051_signed.pdf). Backend menyusunnya
// sbg prefix + no_rawat + "_signed.pdf" (no_order kosong → tanpa kode
// dokter). Catatan: nama ini per no_rawat, jadi pasien ranap dgn >1 DPJP
// yg masing2 tanda tangan akan saling menimpa file — yg terakhir diunduh.
// Nama dokumen di tracking_dokumen_ttd (namaDokumenRingkasan) TIDAK berubah.
export const opsiSimpanRingkasan = (t: Pick<RingkasanTarget, 'no_rawat' | 'kd_dokter'>) =>
  ({ no_rawat: t.no_rawat, no_order: '', prefix: 'RiwayatPerawatan_' });

// kdDokterDariNamaRingkasan — kebalikan namaDokumenRingkasan (dipakai
// submenu Selesai, yg cuma punya nama_dokumen dari tracking).
export const kdDokterDariNamaRingkasan = (namaDokumen: string) =>
  /^Ringkasan_Perawatan_\d+_(.+)\.pdf$/.exec(namaDokumen)?.[1] || '';

// unduhRingkasanTte — order_id dicari di tracking_dokumen_ttd, lalu unduh &
// simpan ke Berkas Rawat.
export async function unduhRingkasanTte(t: RingkasanTarget): Promise<void> {
  const namaDokumen = namaDokumenRingkasan(t);
  try {
    const lookupRes = await fetch(`/api/peruri/tracking/order-id?no_rawat=${encodeURIComponent(t.no_rawat)}&nama_dokumen=${encodeURIComponent(namaDokumen)}`);
    const lookupData = await lookupRes.json().catch(() => ({}));
    if (!lookupRes.ok || !lookupData.order_id) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Belum ada dokumen yang ditandatangani untuk pasien & dokter ini.' });
      return;
    }
    await unduhDokumenTte(String(lookupData.order_id), namaDokumen, opsiSimpanRingkasan(t));
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }
}
