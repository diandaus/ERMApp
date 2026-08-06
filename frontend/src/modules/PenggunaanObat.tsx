import React from 'react';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Penggunaan Obat (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgPenggunaObat.java — laporan READ-ONLY murni
// (tidak ada tombol Simpan/Hapus di Java, cuma Cari/Cetak) yang menjawab
// "obat X dipakai oleh pasien mana saja, kapan, berapa banyak". Lihat
// backend/apotek_penggunaan_obat_handler.go untuk detail replikasi query
// Java & penyederhanaan struktural (JTable flat-fake-row 3 lapis + N+1
// query diganti satu query flat + grouping, dan obat dengan nol pemakaian
// di rentang tanggal tidak lagi ikut ditampilkan).
//
// TIDAK auto-load saat dibuka (sama pola dengan Darurat Stok/Riwayat
// Barang Medis) — tabel kosong sampai user klik "Cari".
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
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
};

type KvOpsi = { kode: string; nama: string };

const STATUS_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'Ralan', label: 'Rawat Jalan' },
  { value: 'Ranap', label: 'Rawat Inap' },
];

type PemakaianItem = {
  tgl_perawatan: string;
  jam: string;
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  alamat: string;
  jml: number;
  asal_stok: string;
  status: string;
  no_resep: string;
  dokter: string;
};

type PenggunaanObatRow = {
  kode_brng: string;
  nama_brng: string;
  kode_sat: string;
  jumlah_obat: number;
  pemakaian: PemakaianItem[];
};

export const PenggunaanObatView: React.FC = () => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(30));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [status, setStatus] = React.useState('');
  const [kdPj, setKdPj] = React.useState('');
  const [kdBangsal, setKdBangsal] = React.useState('');
  const [kdjns, setKdjns] = React.useState('');
  const [kodeKategori, setKodeKategori] = React.useState('');
  const [kodeGolongan, setKodeGolongan] = React.useState('');
  const [kdDokter, setKdDokter] = React.useState('');
  const [searchText, setSearchText] = React.useState('');

  const [penjabList, setPenjabList] = React.useState<KvOpsi[]>([]);
  const [bangsalList, setBangsalList] = React.useState<KvOpsi[]>([]);
  const [jenisList, setJenisList] = React.useState<KvOpsi[]>([]);
  const [kategoriList, setKategoriList] = React.useState<KvOpsi[]>([]);
  const [golonganList, setGolonganList] = React.useState<KvOpsi[]>([]);
  const [dokterList, setDokterList] = React.useState<KvOpsi[]>([]);

  const [items, setItems] = React.useState<PenggunaanObatRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<{ nama_instansi: string; alamat: string; logo_url: string; kontak: string; email_rs: string }>({
    nama_instansi: '', alamat: '', logo_url: '', kontak: '', email_rs: '',
  });

  React.useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setSettings(data))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    fetch('/api/pendaftaran/penjab')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPenjabList(Array.isArray(data) ? data.map((p: any) => ({ kode: p.kd_pj, nama: p.nm_pj })) : []))
      .catch(() => {});
    fetch('/api/bangsal/opsi')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBangsalList(Array.isArray(data) ? data.map((b: any) => ({ kode: b.kd_bangsal, nama: b.nm_bangsal })) : []))
      .catch(() => {});
    fetch('/api/apotek/jenis')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setJenisList(Array.isArray(data) ? data.map((j: any) => ({ kode: j.kdjns, nama: j.nama })) : []))
      .catch(() => {});
    fetch('/api/apotek/kategori')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setKategoriList(Array.isArray(data) ? data.map((k: any) => ({ kode: k.kode, nama: k.nama })) : []))
      .catch(() => {});
    fetch('/api/apotek/golongan')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGolonganList(Array.isArray(data) ? data.map((g: any) => ({ kode: g.kode, nama: g.nama })) : []))
      .catch(() => {});
    fetch('/api/dokter')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDokterList(Array.isArray(data) ? data.map((d: any) => ({ kode: d.kd_dokter, nama: d.nm_dokter })) : []))
      .catch(() => {});
  }, []);

  const fetchData = React.useCallback(async () => {
    if (!tgl1 || !tgl2) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ tgl1, tgl2 });
      if (status) params.set('status', status);
      if (kdPj) params.set('kd_pj', kdPj);
      if (kdBangsal) params.set('kd_bangsal', kdBangsal);
      if (kdjns) params.set('kdjns', kdjns);
      if (kodeKategori) params.set('kode_kategori', kodeKategori);
      if (kodeGolongan) params.set('kode_golongan', kodeGolongan);
      if (kdDokter) params.set('kd_dokter', kdDokter);
      if (searchText) params.set('search', searchText);
      const res = await fetch(`/api/apotek/penggunaan-obat?${params.toString()}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, status, kdPj, kdBangsal, kdjns, kodeKategori, kodeGolongan, kdDokter, searchText]);

  const totalPemakaian = items.reduce((sum, r) => sum + r.jumlah_obat, 0);

  // handleCetak — cetak LAPORAN PENGGUNAAN OBAT (rekap semua obat +
  // pemakaian per pasien yang lolos filter saat ini), pola print-HTML
  // browser sama dengan modul lain (window.open + document.write +
  // print() bawaan browser). Data per-obat diratakan (flatten) jadi satu
  // baris per pemakaian, diikuti baris "Jumlah Obat :" per obat — versi
  // cetak yang tetap mempertahankan subtotal per obat (beda dari
  // tampilan layar yang expand/collapse), supaya laporan tercetak tetap
  // terbaca sebagai satu tabel utuh di atas kertas.
  const handleCetak = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';
    const kontakEmail = [settings.kontak, settings.email_rs ? `E-mail : ${settings.email_rs}` : '']
      .filter(Boolean)
      .join(', ');

    const rowsHtml = items.map((row) => {
      const detailRows = row.pemakaian.map((p) => `
        <tr>
          <td>${row.kode_brng}</td>
          <td>${row.nama_brng}</td>
          <td>${p.nm_pasien}<br/><span style="color:#666;font-size:9.5px">${p.tgl_perawatan.slice(0, 10)} ${p.jam} · ${p.no_rawat} · ${p.no_rkm_medis}</span></td>
          <td>${p.alamat}</td>
          <td style="text-align:right">${p.jml}</td>
          <td>${p.asal_stok}</td>
          <td style="text-align:center">${p.status === 'Ranap' ? 'Rawat Inap' : p.status === 'Ralan' ? 'Rawat Jalan' : p.status}</td>
          <td>${p.no_resep || '-'}</td>
          <td>${p.dokter || '-'}</td>
        </tr>
      `).join('');
      return `${detailRows}
        <tr>
          <td colspan="4" style="text-align:right"><b>Jumlah Obat (${row.nama_brng})</b></td>
          <td style="text-align:right"><b>${row.jumlah_obat}</b></td>
          <td colspan="4"></td>
        </tr>`;
    }).join('');

    const filterParts = [
      status ? `Status: ${status === 'Ranap' ? 'Rawat Inap' : 'Rawat Jalan'}` : '',
      kdPj ? `Cara Bayar: ${penjabList.find((p) => p.kode === kdPj)?.nama || kdPj}` : '',
      kdBangsal ? `Asal Stok: ${bangsalList.find((b) => b.kode === kdBangsal)?.nama || kdBangsal}` : '',
      kdjns ? `Jenis: ${jenisList.find((j) => j.kode === kdjns)?.nama || kdjns}` : '',
      kodeKategori ? `Kategori: ${kategoriList.find((k) => k.kode === kodeKategori)?.nama || kodeKategori}` : '',
      kodeGolongan ? `Golongan: ${golonganList.find((g) => g.kode === kodeGolongan)?.nama || kodeGolongan}` : '',
      kdDokter ? `Dokter Peresep: ${dokterList.find((d) => d.kode === kdDokter)?.nama || kdDokter}` : '',
      searchText ? `Cari: "${searchText}"` : '',
    ].filter(Boolean).join(' — ');

    printWindow.document.write(`
      <html>
        <head>
          <title>Laporan Penggunaan Obat ${tgl1} s.d. ${tgl2}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; padding: 16px; color: #000; }
            table.tbl_form td { border: 0; vertical-align: middle; }
            .info { margin: 10px 0; font-size: 12px; }
            .info div { margin-bottom: 2px; }
            hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
            table.tbl_data { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
            table.tbl_data th, table.tbl_data td { border: 1px solid #333; padding: 3px 5px; vertical-align: top; }
            table.tbl_data th { background: #f3f4f6; }
            .totals { margin-top: 8px; font-size: 12px; }
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
          <center><font color="#000000" size="2" face="Tahoma"><b>LAPORAN PENGGUNAAN OBAT</b></font></center>
          <div class="info">
            <div>Periode : ${tgl1} s.d. ${tgl2}</div>
            ${filterParts ? `<div>Filter : ${filterParts}</div>` : ''}
          </div>
          <table class="tbl_data">
            <thead>
              <tr>
                <th>Kode Barang</th>
                <th>Nama Barang</th>
                <th>Pasien</th>
                <th>Alamat Pasien</th>
                <th>Jml</th>
                <th>Asal Stok</th>
                <th>Status</th>
                <th>No. Resep</th>
                <th>Dokter Peresep</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div style="font-weight:bold">Jumlah Obat (${items.length}) — Total Pemakaian : ${totalPemakaian}</div>
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
        <div style={{ width: 140 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</label>
          <PillSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
        <div style={{ width: 170 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cara Bayar</label>
          <PillSelect value={kdPj} onChange={setKdPj} options={[{ value: '', label: 'Semua' }, ...penjabList.map((p) => ({ value: p.kode, label: p.nama }))]} />
        </div>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Asal Stok</label>
          <PillSelect value={kdBangsal} onChange={setKdBangsal} options={[{ value: '', label: 'Semua' }, ...bangsalList.map((b) => ({ value: b.kode, label: b.nama }))]} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jenis</label>
          <PillSelect value={kdjns} onChange={setKdjns} options={[{ value: '', label: 'Semua' }, ...jenisList.map((j) => ({ value: j.kode, label: j.nama }))]} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Kategori</label>
          <PillSelect value={kodeKategori} onChange={setKodeKategori} options={[{ value: '', label: 'Semua' }, ...kategoriList.map((k) => ({ value: k.kode, label: k.nama }))]} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Golongan</label>
          <PillSelect value={kodeGolongan} onChange={setKodeGolongan} options={[{ value: '', label: 'Semua' }, ...golonganList.map((g) => ({ value: g.kode, label: g.nama }))]} />
        </div>
        <div style={{ width: 170 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dokter Peresep</label>
          <PillSelect value={kdDokter} onChange={setKdDokter} options={[{ value: '', label: 'Semua' }, ...dokterList.map((d) => ({ value: d.kode, label: d.nama }))]} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Cari</label>
            <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
              {hasSearched ? `${items.length} obat — total pemakaian ${totalPemakaian}` : ''}
            </span>
          </div>
          <input
            style={inputStyle}
            placeholder="Kode / Nama Barang..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchData(); }}
          />
        </div>
        <button
          type="button"
          onClick={fetchData}
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
        <button
          type="button"
          onClick={handleCetak}
          disabled={!hasSearched}
          title="Cetak Laporan Penggunaan Obat"
          style={{ flexShrink: 0, width: 32, height: 32, padding: 0, borderRadius: 4, border: '1px solid #d1d5db', background: hasSearched ? '#ffffff' : '#f3f4f6', color: hasSearched ? '#374151' : '#9ca3af', cursor: hasSearched ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Jml Transaksi</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Jumlah Obat</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Pilih filter lalu klik "Cari" untuk menampilkan laporan penggunaan obat</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada penggunaan obat pada filter ini</td></tr>
            ) : (
              items.map((row, index) => {
                const isOpen = expanded === row.kode_brng;
                return (
                  <React.Fragment key={row.kode_brng}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : row.kode_brng)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{row.kode_brng}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 600 }}>{row.nama_brng}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{row.kode_sat}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#374151' }}>{row.pemakaian.length}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#111827', fontWeight: 700 }}>{row.jumlah_obat}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                            <thead>
                              <tr style={{ color: '#6b7280' }}>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Pasien</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Alamat Pasien</th>
                                <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jml</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Asal Stok</th>
                                <th style={{ padding: '3px 6px', textAlign: 'center' }}>Status</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>No. Resep</th>
                                <th style={{ padding: '3px 6px', textAlign: 'left' }}>Dokter Peresep</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.pemakaian.map((p, pi) => (
                                <tr key={`${p.no_rawat}-${p.tgl_perawatan}-${p.jam}-${pi}`}>
                                  <td style={{ padding: '3px 6px', color: '#111827' }}>
                                    <div>{p.nm_pasien}</div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                                      {p.tgl_perawatan.slice(0, 10)} {p.jam} · {p.no_rawat} · {p.no_rkm_medis}
                                    </div>
                                  </td>
                                  <td style={{ padding: '3px 6px', color: '#6b7280' }}>{p.alamat}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{p.jml}</td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{p.asal_stok}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600, background: p.status === 'Ranap' ? '#dbeafe' : '#fef3c7', color: p.status === 'Ranap' ? '#1d4ed8' : '#92400e' }}>
                                      {p.status === 'Ranap' ? 'Rawat Inap' : p.status === 'Ralan' ? 'Rawat Jalan' : p.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{p.no_resep || '-'}</td>
                                  <td style={{ padding: '3px 6px', color: '#374151' }}>{p.dokter || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
