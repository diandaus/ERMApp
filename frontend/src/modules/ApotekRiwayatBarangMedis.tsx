import React from 'react';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Riwayat Obat, Alkes & BHP (tab utama modul Apotek). Cocok
// dengan dialog Khanza Desktop inventory/DlgRiwayatBarangMedis.java —
// laporan READ-ONLY murni (tidak ada tombol Simpan/Hapus di Java sama
// sekali, cuma Cari/Cetak) atas tabel log `riwayat_barang_medis`, yang
// diisi lewat catatRiwayatBarangMedis di backend/apotek_riwayat_barang_medis.go
// — dipanggil dari Stok Opname, Mutasi, Penerimaan, dan approve
// Permintaan (retrofit, lihat komentar di file itu untuk detail).
// ============================================================================

const pillSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 32px 7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  background: '#ffffff',
  color: '#111827',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: '#059669',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      flexShrink: 0,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const PillSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={pillSelectStyle}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <StepperIcon />
  </div>
);

const todayStr = () => localDateStr();

type KvOpsi = { kode: string; nama: string };

const POSISI_OPTIONS = [
  'Pemberian Obat',
  'Pengadaan',
  'Penerimaan',
  'Piutang',
  'Retur Beli',
  'Retur Jual',
  'Retur Piutang',
  'Mutasi',
  'Opname',
  'Resep Pulang',
  'Retur Pasien',
  'Stok Pasien Ranap',
  'Pengambilan Medis',
  'Penjualan',
  'Stok Keluar',
  'Hibah',
];

const posisiColor = (posisi: string) => {
  if (posisi === 'Mutasi') return '#2563eb';
  if (posisi === 'Opname') return '#d97706';
  if (posisi === 'Pengadaan' || posisi === 'Penerimaan' || posisi === 'Hibah') return '#059669';
  return '#6b7280';
};

type RiwayatRow = {
  kode_brng: string;
  nama_brng: string;
  stok_awal: number;
  masuk: number;
  keluar: number;
  stok_akhir: number;
  posisi: string;
  tanggal: string;
  jam: string;
  petugas: string;
  kd_bangsal: string;
  nm_bangsal: string;
  status: string;
  no_batch: string;
  no_faktur: string;
  keterangan: string;
};

export const ApotekRiwayatBarangMedisView: React.FC = () => {
  const [tgl1, setTgl1] = React.useState(todayStr());
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [posisi, setPosisi] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [bangsal, setBangsal] = React.useState<KvOpsi[]>([]);
  const [items, setItems] = React.useState<RiwayatRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [settings, setSettings] = React.useState<{ nama_instansi: string; alamat: string; logo_url: string; kontak: string; email_rs: string }>({
    nama_instansi: '', alamat: '', logo_url: '', kontak: '', email_rs: '',
  });

  React.useEffect(() => {
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBangsal(data.bangsal || []))
      .catch(() => {});
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSettings(data))
      .catch(() => {});
  }, []);

  // Query ke riwayat_barang_medis tidak ter-index di kolom tanggal (lihat
  // catatan performa apotek_riwayat_barang_medis.go) — full table scan yang
  // mahal kalau dipicu otomatis tiap keystroke/mount. Makanya laporan ini
  // baru query ke backend saat user eksplisit klik "Cari" dengan rentang
  // tanggal yang jelas, mirip DlgRiwayatBarangMedis.java yang juga tidak
  // auto-load. Pencarian teks bebas (searchText) difilter di client atas
  // data yang sudah termuat, jadi tidak menembak DB ulang tiap ketik.
  const fetchRiwayat = React.useCallback(async () => {
    if (!tgl1 || !tgl2) return;
    setLoading(true);
    setHasSearched(true);
    try {
      let url = `/api/apotek/riwayat-barang-medis?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (kdBangsal) url += `&kd_bangsal=${encodeURIComponent(kdBangsal)}`;
      if (posisi) url += `&posisi=${encodeURIComponent(posisi)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, kdBangsal, posisi]);

  const displayedItems = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.kode_brng, item.nama_brng, item.petugas, item.nm_bangsal, item.no_batch, item.no_faktur, item.keterangan, item.posisi]
        .some((field) => (field || '').toLowerCase().includes(q))
    );
  }, [items, searchText]);

  // handleCetak — cetak LAPORAN RIWAYAT BARANG MEDIS (rekap semua baris
  // yang lolos filter tanggal/lokasi/posisi/cari saat ini), pola
  // print-HTML browser sama dengan modul lain (window.open +
  // document.write + print() bawaan browser). Pakai `displayedItems`
  // (sudah difilter searchText di client), tidak perlu request baru.
  const handleCetak = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';
    const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
      .filter(Boolean)
      .join(', ');

    const rowsHtml = displayedItems.map((it, index) => `
      <tr>
        <td style="text-align:center">${index + 1}</td>
        <td>${it.tanggal.slice(0, 10)} ${it.jam}</td>
        <td>${it.nama_brng || it.kode_brng}</td>
        <td style="text-align:right">${it.stok_awal}</td>
        <td style="text-align:right">${it.masuk > 0 ? `+${it.masuk}` : '-'}</td>
        <td style="text-align:right">${it.keluar > 0 ? `-${it.keluar}` : '-'}</td>
        <td style="text-align:right">${it.stok_akhir}</td>
        <td>${it.posisi}</td>
        <td>${it.nm_bangsal || it.kd_bangsal}</td>
        <td>${it.petugas || '-'}</td>
        <td>${it.status}</td>
        <td>${it.keterangan || '-'}</td>
      </tr>
    `).join('');

    const filterParts = [
      kdBangsal ? `Lokasi: ${bangsal.find((b) => b.kode === kdBangsal)?.nama || kdBangsal}` : '',
      posisi ? `Posisi: ${posisi}` : '',
      searchText ? `Cari: "${searchText}"` : '',
    ].filter(Boolean).join(' — ');

    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Riwayat Barang Medis ${tgl1} s.d. ${tgl2}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; padding: 16px; color: #000; }
            table.tbl_form td { border: 0; vertical-align: middle; }
            .info { margin: 10px 0; font-size: 12px; }
            .info div { margin-bottom: 2px; }
            hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
            table.tbl_data { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
            table.tbl_data th, table.tbl_data td { border: 1px solid #333; padding: 3px 5px; }
            table.tbl_data th { background: #f3f4f6; }
            .totals { margin-top: 8px; font-size: 12px; }
            .totals div { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 2px; }
          </style>
        </head>
        <body>
          <table width="100%" align="center" border="0" class="tbl_form" cellspacing="0" cellpadding="0">
            <tr>
              <td width="15%">
                ${logoSrc ? `<img width="50" height="50" src="${logoSrc}" />` : ''}
              </td>
              <td width="70%">
                <center>
                  <font color="#000000" size="3" face="Tahoma"><b>${settings.nama_instansi}</b></font><br/>
                  <font color="#000000" size="1" face="Tahoma">
                    ${settings.alamat}${kontakEmail ? `<br/>${kontakEmail}` : ''}
                  </font>
                </center>
              </td>
              <td width="15%"></td>
            </tr>
          </table>
          <hr/>
          <center><font color="#000000" size="2" face="Tahoma"><b>LAPORAN RIWAYAT BARANG MEDIS</b></font></center>
          <div class="info">
            <div>Periode : ${tgl1} s.d. ${tgl2}</div>
            ${filterParts ? `<div>Filter : ${filterParts}</div>` : ''}
          </div>
          <table class="tbl_data">
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal/Jam</th>
                <th>Barang</th>
                <th>Stok Awal</th>
                <th>Masuk</th>
                <th>Keluar</th>
                <th>Stok Akhir</th>
                <th>Posisi</th>
                <th>Lokasi</th>
                <th>Petugas</th>
                <th>Status</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div style="font-weight:bold"><span>Jumlah Baris : ${displayedItems.length}</span></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ width: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Lokasi</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua Lokasi' }, ...bangsal.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ width: 180 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Posisi</label>
          <PillSelect value={posisi} onChange={setPosisi} options={[{ value: '', label: 'Semua Posisi' }, ...POSISI_OPTIONS.map((p) => ({ value: p, label: p }))]} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari (di hasil yang sudah dimuat)</label>
          <input style={inputStyle} placeholder="Kode / nama barang / petugas / no.faktur / keterangan..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <button
          type="button"
          onClick={fetchRiwayat}
          disabled={loading || !tgl1 || !tgl2}
          style={{
            padding: '7px 20px',
            borderRadius: 4,
            border: 'none',
            background: loading || !tgl1 || !tgl2 ? '#9ca3af' : '#059669',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading || !tgl1 || !tgl2 ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Memuat...' : 'Cari'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8, whiteSpace: 'nowrap' }}>{hasSearched ? `${displayedItems.length} baris` : ''}</span>
        <button
          type="button"
          onClick={handleCetak}
          disabled={!hasSearched}
          title="Cetak Laporan Riwayat Barang Medis"
          style={{ flexShrink: 0, width: 32, height: 32, padding: 0, borderRadius: 4, border: '1px solid #d1d5db', background: hasSearched ? '#ffffff' : '#f3f4f6', color: hasSearched ? '#374151' : '#9ca3af', cursor: hasSearched ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </button>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tanggal / Jam</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Barang</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Awal</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Masuk</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Keluar</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Akhir</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Posisi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lokasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Petugas</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Pilih rentang tanggal lalu klik "Cari" untuk menampilkan riwayat</td></tr>
            ) : displayedItems.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada riwayat pada rentang ini</td></tr>
            ) : (
              displayedItems.map((item, index) => (
                <tr key={`${item.kode_brng}-${item.tanggal}-${item.jam}-${item.kd_bangsal}-${index}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                    {item.tanggal.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{item.jam}</span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ color: '#111827' }}>{item.nama_brng || item.kode_brng}</div>
                    <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{item.kode_brng}</div>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{item.stok_awal}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: item.masuk > 0 ? '#059669' : '#374151', fontWeight: item.masuk > 0 ? 600 : 400 }}>
                    {item.masuk > 0 ? `+${item.masuk}` : '-'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: item.keluar > 0 ? '#dc2626' : '#374151', fontWeight: item.keluar > 0 ? 600 : 400 }}>
                    {item.keluar > 0 ? `-${item.keluar}` : '-'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#111827', fontWeight: 600 }}>{item.stok_akhir}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ color: posisiColor(item.posisi), fontWeight: 600 }}>{item.posisi}</span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_bangsal || item.kd_bangsal}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.petugas || '-'}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: item.status === 'Hapus' ? '#fef2f2' : '#ecfdf5', color: item.status === 'Hapus' ? '#dc2626' : '#059669' }}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{item.keterangan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
