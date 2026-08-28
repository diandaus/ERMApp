# DNS Lokal RS — Supaya Presensi Tetap Bisa Diakses Saat Internet Provider Mati

## Latar belakang

`presensi.rsislamibnusinasigli.com` dipakai dari **dua** jalur (split-horizon DNS):

- **Dari luar RS** — DNS publik (Cloudflare) mengarahkan ke Cloudflare Tunnel, lalu `cloudflared` di server meneruskan ke Apache (`deploy/ermapp-external.conf`, port 8082).
- **Dari dalam RS (WiFi RS)** — DNS lokal (Mikrotik) HARUS mengarahkan langsung ke IP internal server (`192.168.1.220`), lalu Apache melayani langsung (`deploy/ermapp.conf`, vhost `*:443`).

Jalur kedua ini **sama sekali tidak lewat internet** — Apache & backend Go-nya jalan lokal di server RS. Jadi kalau internet dari provider mati, staf yang connect ke WiFi RS **seharusnya** tetap bisa akses presensi seperti biasa.

**Satu-satunya titik rawan**: kalau HP staf query DNS ke server DNS publik (mis. `8.8.8.8`/`1.1.1.1`) alih-alih ke Mikrotik, maka begitu internet mati, HP gagal menerjemahkan `presensi.rsislamibnusinasigli.com` jadi IP sama sekali — padahal server-nya sendiri hidup dan bisa dijangkau lewat jaringan lokal. Dokumen ini langkah-langkah memastikan itu tidak terjadi.

**Berlaku juga untuk `erm.rsislamibnusinasigli.com`** (aplikasi web penuh, `deploy/erm.conf` + `deploy/erm-external.conf`) — pola split-horizon-nya identik, tinggal tambah satu entri static DNS lagi di Mikrotik (langkah 2 di bawah) yang mengarah ke IP internal server yang sama.

## 1. Pastikan DHCP WiFi RS membagikan DNS Mikrotik (bukan DNS publik)

Buka **Winbox** (atau WebFig via browser ke IP Mikrotik):

1. Menu **IP > DHCP Server > Networks**.
2. Klik network yang dipakai WiFi RS (cocokkan dari subnet-nya, mis. `192.168.1.0/24`).
3. Cek field **DNS Servers**:
   - **BENAR**: diisi IP Mikrotik sendiri (mis. `192.168.1.1`) — supaya semua query DNS dari HP staf lewat Mikrotik dulu, baru Mikrotik yang tahu mana yang perlu di-override secara lokal (langkah 2) dan mana yang perlu diteruskan ke internet.
   - **SALAH/RAWAN**: diisi langsung `8.8.8.8`, `1.1.1.1`, atau DNS ISP — kalau begini, HP staf melompati Mikrotik sepenuhnya untuk urusan DNS, jadi override lokal presensi.rsislamibnusinasigli.com TIDAK PERNAH kepakai walau internet normal (kebetulan tetap dapat IP publik lewat Cloudflare, tapi begitu internet mati, resolusi gagal total).
4. Kalau salah, ganti ke IP Mikrotik, lalu klik **Apply/OK**.
5. Di HP staf: lepas dari WiFi RS lalu connect ulang (supaya dapat setting DHCP baru — HP yang sudah lama connect biasanya masih pegang setting lama sampai reconnect/renew lease).

## 2. Pastikan ada static DNS override di Mikrotik

1. Menu **IP > DNS**.
2. Klik tombol **Static** (atau tab Static di jendela DNS Settings).
3. Pastikan ada entri:
   - **Name**: `presensi.rsislamibnusinasigli.com`
   - **Address**: `192.168.1.220` (IP internal server ERMApp — sesuaikan kalau IP servernya beda)
   - **Type**: `A`
4. Kalau belum ada, klik **+** dan isi seperti di atas.

Dengan langkah 1+2 selesai: HP staf di WiFi RS query DNS ke Mikrotik → Mikrotik langsung jawab dari entri static (tidak perlu tanya ke internet sama sekali) → 100% jalan walau WAN Mikrotik putus.

## 3. Cara test (WAJIB dicoba, jangan cuma diasumsikan benar)

1. Connect HP ke WiFi RS, pastikan bisa buka `https://presensi.rsislamibnusinasigli.com/` seperti biasa dulu (baseline).
2. Cabut kabel WAN/internet dari Mikrotik (atau matikan sebentar dari sisi ISP/ONT-nya) — **lakukan di luar jam sibuk**, ini akan memutus SEMUA akses internet RS sementara, bukan cuma presensi.
3. Dari HP yang **masih connect WiFi RS** (jangan disconnect-reconnect saat WAN mati, supaya benar-benar mensimulasikan "internet mati mendadak"), coba buka lagi `https://presensi.rsislamibnusinasigli.com/`.
4. **Berhasil kebuka** → setup sudah benar, aman dari gangguan internet provider.
5. **Gagal/timeout** → kemungkinan besar HP masih pegang DNS lama dari sebelum langkah 1 diterapkan (coba toggle WiFi off/on di HP dulu, baru test ulang), atau ada langkah di atas yang belum tepat.
6. Sambungkan lagi WAN Mikrotik setelah selesai test.

### Cara cek cepat tanpa harus matikan internet RS

Dari laptop/HP yang connect WiFi RS, cek DNS yang benar-benar dipakai:

- **Android/HP**: install app semacam "Ping & DNS" atau pakai browser buka `chrome://net-internals` (Chrome) untuk lihat resolusi DNS.
- **Laptop (Mac/Linux)**: buka Terminal, jalankan:
  ```
  nslookup presensi.rsislamibnusinasigli.com
  ```
  Hasilnya harus `192.168.1.220` (IP internal), BUKAN IP Cloudflare (biasanya `104.x.x.x` atau `172.x.x.x`). Kalau yang muncul IP Cloudflare padahal lagi di WiFi RS, berarti override lokal belum kepakai — cek lagi langkah 1 & 2.

## 4. Cadangan darurat (opsional, tanpa perlu ubah apa pun di Mikrotik)

Kalau langkah di atas belum sempat diterapkan/diverifikasi, staf tetap punya jalur darurat: bookmark langsung `https://192.168.1.220/` di HP.

**Catatan**: browser akan menampilkan peringatan sertifikat ("Not Private"/"Your connection is not private") karena sertifikat Let's Encrypt yang dipakai server cuma valid untuk hostname `presensi.rsislamibnusinasigli.com`, bukan untuk alamat IP mentah. Staf perlu klik "Lanjutkan/Advanced > Proceed" tiap kali — tidak nyaman untuk dipakai harian, tapi berfungsi sebagai jalur darurat kalau DNS lokal belum benar.

## Ringkasan

| Kondisi | Internet provider hidup | Internet provider mati |
|---|---|---|
| WiFi RS, DNS Mikrotik benar (langkah 1+2) | ✅ Jalan (lewat jalur internal) | ✅ Tetap jalan (tidak butuh internet) |
| WiFi RS, DNS masih ke server publik | ✅ Jalan (kebetulan, lewat Cloudflare) | ❌ Gagal resolve DNS |
| Dari luar RS (data seluler/WiFi lain) | ✅ Jalan (lewat Cloudflare Tunnel) | ❌ Wajar gagal (memang butuh internet) |
