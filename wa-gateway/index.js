// wa-gateway — servis Node.js terpisah (Baileys, WhatsApp Web tidak resmi)
// dipakai backend Go ERMApp buat kirim notifikasi WhatsApp (mis. hasil
// pemeriksaan radiologi) TANPA biaya per pesan spt WhatsApp Business API
// resmi. Cara pakai: jalankan servis ini, buka /qr dari Admin > Pengaturan
// WhatsApp Gateway di ERMApp buat scan QR pakai HP yg nomornya mau jadi
// "bot" pengirim (persis login WhatsApp Web biasa). Sesi login disimpan
// lokal di folder auth_session/ supaya tidak perlu scan ulang tiap restart.
require('dotenv').config();
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const PORT = process.env.PORT || 3200;
const API_KEY = process.env.API_KEY || '';
const AUTH_DIR = './auth_session';

const logger = pino({ level: 'silent' });

let sock = null;
let latestQR = null; // string QR mentah dari Baileys, di-render ke PNG saat diminta lewat /qr
let connectionState = 'connecting'; // 'connecting' | 'qr' | 'open' | 'close'

// startSocket — buat/reconnect koneksi Baileys. Dipanggil sekali saat
// servis start, lalu otomatis dipanggil ulang kalau koneksi putus (KECUALI
// putus karena logout eksplisit, spy tidak infinite-loop minta scan QR).
async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['ERMApp', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      connectionState = 'qr';
      console.log('[wa-gateway] QR baru tersedia — buka /qr untuk scan');
    }

    if (connection === 'open') {
      latestQR = null;
      connectionState = 'open';
      console.log('[wa-gateway] Terhubung ke WhatsApp:', sock.user?.id);
    }

    if (connection === 'close') {
      connectionState = 'close';
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log('[wa-gateway] Koneksi terputus. Logged out?', loggedOut);
      if (!loggedOut) {
        startSocket();
      } else {
        latestQR = null;
        console.log('[wa-gateway] Sesi logout — hapus folder auth_session/ dan restart servis utk pairing ulang.');
      }
    }
  });
}

startSocket().catch((err) => console.error('[wa-gateway] Gagal start:', err));

// --- HTTP API ---
const app = express();
app.use(express.json());

function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // API_KEY kosong = auth dimatikan (cuma utk dev lokal)
  if (req.header('X-API-Key') !== API_KEY) {
    return res.status(401).json({ error: 'API key tidak valid' });
  }
  next();
}

app.get('/status', requireApiKey, (req, res) => {
  res.json({
    state: connectionState,
    connected: connectionState === 'open',
    number: connectionState === 'open' ? sock?.user?.id?.split(':')[0] : null,
  });
});

app.get('/qr', requireApiKey, async (req, res) => {
  if (connectionState === 'open') {
    return res.json({ connected: true });
  }
  if (!latestQR) {
    return res.json({ connected: false, qr: null, message: 'QR belum tersedia, coba lagi sebentar' });
  }
  const qrDataUrl = await QRCode.toDataURL(latestQR);
  res.json({ connected: false, qr: qrDataUrl });
});

// POST /send — body: { to: "62812xxxxxxx", message: "..." }
// Nomor tujuan format internasional TANPA "+" (mis. 62812xxxxxxx), diubah
// ke format JID WhatsApp (@s.whatsapp.net) di sini.
app.post('/send', requireApiKey, async (req, res) => {
  if (connectionState !== 'open') {
    return res.status(503).json({ error: 'WhatsApp gateway belum terhubung — scan QR dulu di Admin > Pengaturan WhatsApp Gateway' });
  }
  const { to, message } = req.body || {};
  if (!to || !message) {
    return res.status(400).json({ error: 'to dan message wajib diisi' });
  }
  const digits = String(to).replace(/[^0-9]/g, '');
  if (!digits) {
    return res.status(400).json({ error: 'Nomor tujuan tidak valid' });
  }
  const jid = `${digits}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jid, { text: message });
    res.json({ message: 'Pesan berhasil dikirim' });
  } catch (err) {
    res.status(502).json({ error: 'Gagal mengirim pesan: ' + err.message });
  }
});

// POST /logout — putuskan sesi & hapus kredensial, dipakai tombol "Ganti
// Nomor" di Admin > Pengaturan WhatsApp Gateway.
app.post('/logout', requireApiKey, async (req, res) => {
  try {
    if (sock) await sock.logout();
  } catch { /* sudah putus, abaikan */ }
  res.json({ message: 'Sesi WhatsApp diputus, silakan scan QR baru' });
});

app.listen(PORT, () => {
  console.log(`[wa-gateway] Berjalan di port ${PORT}`);
});
