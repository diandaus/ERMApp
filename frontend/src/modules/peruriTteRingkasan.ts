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

// tandaTanganRingkasan — balikin true kalau dokumen berhasil ditandatangani
// (caller lalu menandai baris jadi "Sudah"), false kalau batal/gagal (error
// sudah ditampilkan ke user di sini).
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

  showProcessing('Menyiapkan & mengirim dokumen ke Peruri, mohon tunggu...');
  try {
    const email = await getEmailDokter(t);
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

    showProcessing(`Dokumen berhasil terkirim ke Peruri.<br/>Order ID: <b>${escapeHtml(String(orderId))}</b><br/><span style="font-size:12px;color:#6b7280;">Melanjutkan proses tanda tangan...</span>`);
    await new Promise((resolve) => window.setTimeout(resolve, 1200));

    const sessionRes = await fetch(`/api/peruri/session-status?email=${encodeURIComponent(email)}`);
    const sessionData = await sessionRes.json().catch(() => ({ valid: false }));
    const sesiDipakaiUlang = sessionRes.ok && !!sessionData.valid;

    if (!sesiDipakaiUlang) {
      const otpResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
      let tokenSession = otpResp?.data?.tokenSession || otpResp?.tokenSession;
      if (!tokenSession) throw new Error('Peruri tidak mengembalikan tokenSession: ' + JSON.stringify(otpResp));

      hideProcessing();
      const otpCode = await showOtpDialog(email, async () => {
        const resendResp = await peruriPost('/api/peruri/get-otp', { email, sendEmail: '1', sendSms: '0', sendWhatsapp: '0' });
        const newTokenSession = resendResp?.data?.tokenSession || resendResp?.tokenSession;
        if (!newTokenSession) throw new Error('Peruri tidak mengembalikan tokenSession');
        tokenSession = newTokenSession;
      });
      if (!otpCode) return false;

      showProcessing('Memverifikasi OTP & menandatangani dokumen, mohon tunggu...');
      await peruriPost('/api/peruri/validate-otp', { email, tokenSession, otpCode, duration: '1440' });
    } else {
      showProcessing('Sesi OTP masih aktif, menandatangani dokumen, mohon tunggu...');
    }

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
    hideProcessing();

    await Swal.fire({
      icon: 'success', title: 'Berhasil ditandatangani',
      html: `Ringkasan Perawatan berhasil ditandatangani oleh <b>${escapeHtml(t.nm_dokter)}</b> (${escapeHtml(email)}).<br/>Order ID: <b>${escapeHtml(String(orderId))}</b>`
        + (sesiDipakaiUlang ? '<br/><small>(Sesi OTP masih aktif, tidak perlu OTP ulang)</small>' : ''),
    });
    return true;
  } catch (err) {
    hideProcessing();
    Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    return false;
  }
}

// unduhRingkasanTte — ambil dokumen yg SUDAH ditandatangani dari Peruri
// (order_id dicari di tracking_dokumen_ttd), unduh ke komputer & backend
// otomatis menyimpannya ke Berkas Rawat sebagai
// Ringkasan_Perawatan_<no_rawat>_<kd_dokter>_signed.pdf.
export async function unduhRingkasanTte(t: RingkasanTarget): Promise<void> {
  showProcessing('Mengunduh dokumen dari Peruri, mohon tunggu...');
  try {
    const namaDokumen = namaDokumenRingkasan(t);
    const lookupRes = await fetch(`/api/peruri/tracking/order-id?no_rawat=${encodeURIComponent(t.no_rawat)}&nama_dokumen=${encodeURIComponent(namaDokumen)}`);
    const lookupData = await lookupRes.json().catch(() => ({}));
    if (!lookupRes.ok || !lookupData.order_id) {
      hideProcessing();
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Belum ada dokumen yang ditandatangani untuk pasien & dokter ini.' });
      return;
    }

    const res = await fetch('/api/peruri/download-document', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: lookupData.order_id, no_rawat: t.no_rawat, no_order: t.kd_dokter, prefix: 'Ringkasan_Perawatan_' }),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(resData.error || 'Gagal mengunduh dokumen');
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
    a.download = `TTE_${namaDokumen}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    hideProcessing();

    if (resData.uploaded_to_berkasrawat) {
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Dokumen terunduh & otomatis tersimpan ke Berkas Rawat.', timer: 2000, showConfirmButton: false });
    } else {
      Swal.fire({
        icon: 'warning', title: 'Simpan ke Berkas Rawat gagal',
        text: `Dokumen berhasil diunduh ke komputer, tapi GAGAL otomatis tersimpan ke Berkas Rawat${resData.upload_error ? `: ${resData.upload_error}` : '.'}`,
      });
    }
  } catch (err) {
    hideProcessing();
    Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
  }
}
