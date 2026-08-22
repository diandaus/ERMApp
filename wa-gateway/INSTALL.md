# Instalasi WhatsApp Gateway (wa-gateway)

Servis Node.js terpisah yang memakai [Baileys](https://github.com/WhiskeySockets/Baileys)
(WhatsApp Web tidak resmi) untuk mengirim notifikasi WhatsApp dari ERMApp —
**gratis**, tidak seperti WhatsApp Business API resmi yang berbayar per
pesan. Caranya sama seperti login WhatsApp Web biasa: scan QR sekali dari
HP, lalu nomor itu jadi "bot" pengirim pesan untuk aplikasi.

> Karena ini WhatsApp Web tidak resmi, pakai nomor **khusus** untuk bot
> (bukan nomor pribadi/kantor yang aktif dipakai chat manual), dan hindari
> mengirim pesan dalam jumlah besar sekaligus — WhatsApp bisa memblokir
> nomor yang dianggap spam. Cocok untuk notifikasi satu-satu (mis. hasil
> pemeriksaan ke satu pasien), bukan broadcast massal.

## 1. Instalasi Lokal / Development

Butuh Node.js 18 ke atas.

```bash
cd wa-gateway
cp .env.example .env
```

Edit `.env`, isi `API_KEY` dengan string acak sendiri (bebas, cuma dipakai
sebagai kata sandi antara backend Go dan servis ini). Generate contoh:

```bash
openssl rand -hex 24
```

Install dependencies lalu jalankan:

```bash
npm install
npm start
```

Kalau berhasil, akan muncul log:

```
[wa-gateway] Berjalan di port 3200
[wa-gateway] QR baru tersedia — buka /qr untuk scan
```

## 2. Sambungkan ke ERMApp

1. Buka aplikasi ERMApp → **Admin > Pengaturan Bridging**.
2. Cari kartu **"WhatsApp Gateway"** (grup "Integrasi Lainnya"), klik untuk
   expand.
3. Isi:
   - **URL Servis wa-gateway**: `http://localhost:3200` (atau alamat
     server tempat servis ini berjalan, kalau beda mesin dengan backend).
   - **API Key**: sama persis dengan isi `API_KEY` di file `.env` tadi.
4. Klik **Simpan**.
5. Klik tombol **"Pairing (Scan QR)"** — akan muncul modal berisi QR code.
6. Di HP yang nomornya mau dijadikan bot: buka WhatsApp → **Perangkat
   Tertaut** → **Tautkan Perangkat** → scan QR di layar.
7. Setelah berhasil, modal akan menampilkan status **"Terhubung"** beserta
   nomornya. Sesi ini tersimpan di folder `wa-gateway/auth_session/` —
   tidak perlu scan ulang setiap servis di-restart, kecuali sesi di-logout
   manual (tombol "Putuskan / Ganti Nomor") atau di-logout dari HP.

## 3. Deploy ke Server (Production)

Servis ini sudah terintegrasi ke `deploy.sh` di root repo — sekali jalan
otomatis menyiapkan backend Go **dan** wa-gateway sebagai dua service
systemd terpisah.

```bash
cd /path/ke/ERMApp   # root repo, sejajar dengan folder backend/frontend/wa-gateway
bash deploy.sh
```

Yang dilakukan otomatis untuk wa-gateway:

- Install Node.js LTS via NodeSource kalau belum ada.
- Kalau `wa-gateway/.env` belum ada, dibuatkan otomatis dengan `API_KEY`
  acak — **dicetak ke layar saat deploy**, catat nilainya.
- `npm install` dependencies.
- Membuat & mengaktifkan systemd service `wa-gateway` (`Restart=always`,
  otomatis jalan lagi setelah server reboot atau servis crash).

Setelah deploy, isi URL (`http://localhost:3200`) dan API Key yang
dicetak tadi ke Admin > Pengaturan Bridging > WhatsApp Gateway seperti
langkah di bagian 2, lalu lakukan pairing (scan QR) sekali dari server
(butuh akses ke modal Pairing lewat browser yang bisa menjangkau server).

### Mengelola service di server

```bash
sudo systemctl status wa-gateway     # cek status
sudo systemctl restart wa-gateway    # restart manual
sudo journalctl -u wa-gateway -f     # lihat log realtime
```

## 4. Troubleshooting

**"Gagal menghubungi WhatsApp Gateway: connection refused"**
Servisnya belum jalan. Cek `sudo systemctl status wa-gateway` (server) atau
jalankan `npm start` manual (lokal). Pastikan juga URL yang diisi di Admin
sudah benar (termasuk port-nya, default `3200`).

**QR tidak muncul-muncul di modal Pairing**
Baileys butuh beberapa detik untuk generate QR pertama kali setelah servis
start — tunggu sebentar, modal akan otomatis polling tiap 3 detik. Kalau
lama sekali, cek log servis (`sudo journalctl -u wa-gateway -f` atau
`/tmp/wa-gateway.log` kalau dijalankan manual).

**Status "401 API key tidak valid"**
Nilai `API Key` di Admin > Pengaturan Bridging tidak sama persis dengan
`API_KEY` di `wa-gateway/.env`. Samakan salah satu.

**Sesi terputus sendiri / minta scan ulang terus**
Biasanya karena nomor di-logout dari sisi HP (WhatsApp > Perangkat
Tertaut), atau folder `wa-gateway/auth_session/` terhapus/tidak
konsisten (mis. sinkronisasi file yang salah). Hapus folder
`auth_session/` lalu restart servis untuk pairing ulang dari awal.

**Ingin ganti nomor bot**
Klik **"Putuskan / Ganti Nomor"** di modal Pairing (Admin > Pengaturan
Bridging > WhatsApp Gateway), lalu scan QR baru dengan nomor yang
diinginkan.
