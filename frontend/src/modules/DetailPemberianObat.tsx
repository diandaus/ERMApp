import React from 'react';
import { localDateStr } from '../utils/date';

// ============================================================================
// APOTEK — Detail Pemberian Obat (menu baru di sidebar Apotek.tsx). Cocok
// dengan konsep "Detail Pemberian Obat/Barang/Alkes" Khanza Desktop
// (inventory/DlgPemberianObat.java), disederhanakan jadi laporan
// read-only: daftar pasien yang obatnya SUDAH DISERAHKAN pada satu
// tanggal, 2 tab Rawat Jalan/Rawat Inap, filter Tanggal + Jenis Bayar +
// Cari. Lihat backend/apotek_detail_pemberian_obat_handler.go untuk
// query & penyederhanaan (filter tgl_penyerahan, bukan tgl_peresepan —
// beda dari dashboard antrean kerja /api/permintaan-resep/ralan|ranap).
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
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 22, height: 22, borderRadius: '50%', background: '#059669',
      display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

type Penjab = { kd_pj: string; nm_pj: string };

type DetailPemberianObatRow = {
  no_resep: string;
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  nm_dokter: string;
  nm_lokasi: string;
  kd_pj: string;
  jenis_bayar: string;
  tgl_penyerahan: string;
  jam_penyerahan: string;
};

const SUB_TABS: { key: 'ralan' | 'ranap'; label: string }[] = [
  { key: 'ralan', label: 'Rawat Jalan' },
  { key: 'ranap', label: 'Rawat Inap' },
];

// DetailPemberianObatItemRow — 16 kolom, padanan PERSIS tabModePO di
// inventory/DlgPemberianObat.java (lihat komentar di
// backend/apotek_detail_pemberian_obat_handler.go).
type DetailPemberianObatItemRow = {
  tgl_beri: string;
  jam_beri: string;
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  embalase: number;
  tuslah: number;
  jml: number;
  biaya_obat: number;
  total: number;
  h_beli: number;
  gudang: string;
  no_batch: string;
  no_faktur: string;
};

const fmtAngka = (v: number) => v.toLocaleString('id-ID');

const ModalLihatItemPemberianObat: React.FC<{
  target: { no_rawat: string; tanggal: string; nm_pasien: string; no_rkm_medis: string } | null;
  onClose: () => void;
}> = ({ target, onClose }) => {
  const [rows, setRows] = React.useState<DetailPemberianObatItemRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    setLoading(true);
    fetch(`/api/apotek/detail-pemberian-obat/items?no_rawat=${encodeURIComponent(target.no_rawat)}&tanggal=${encodeURIComponent(target.tanggal)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  // handleCetak — padanan cetak "RINCIAN PEMAKAIAN OBAT/BMHP" Khanza
  // Desktop (kop logo+nama+alamat instansi di atas, lalu tabel item),
  // diadaptasi ke skema settings app ini (/api/admin/settings:
  // nama_instansi/alamat/logo_url — versi ringkas dari
  // namars/alamatrs/kabupatenrs/propinsirs/kontakrs/emailrs Khanza yang
  // TIDAK ada di skema app ini). Pola cetak SAMA dengan
  // PreviewBilling.tsx: buka jendela baru, tulis HTML siap-print, panggil
  // window.print() bawaan browser (user pilih "Simpan sebagai PDF" di
  // dialog print) — bukan generate PDF di server, proyek ini belum punya
  // library PDF sisi backend.
  const handleCetak = async () => {
    let settings = { nama_instansi: '', alamat: '', logo_url: '' };
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) settings = await res.json();
    } catch {
      // biarkan kop kosong kalau gagal — tetap bisa cetak tabelnya
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const logoSrc = settings.logo_url
      ? (settings.logo_url.startsWith('/') ? `${window.location.origin}${settings.logo_url}` : settings.logo_url)
      : '';

    const totalBiaya = rows.reduce((sum, r) => sum + (r.total || 0), 0);
    const rowsHtml = rows.map((row, index) => `
      <tr>
        <td style="text-align:center">${index + 1}</td>
        <td>${row.nama_brng}</td>
        <td style="text-align:center">${row.satuan}</td>
        <td style="text-align:right">${fmtAngka(row.jml)}</td>
        <td style="text-align:right">${fmtAngka(row.biaya_obat)}</td>
        <td style="text-align:right">${fmtAngka(row.total)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Rincian Pemakaian Obat/BMHP - ${target.no_rawat}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; padding: 16px; color: #000; }
            table.tbl_form td { border: 0; vertical-align: middle; }
            .info { margin: 10px 0; font-size: 12px; }
            .info div { margin-bottom: 2px; }
            hr { border: none; border-top: 1px solid #000; margin: 8px 0; }
            table.tbl_data { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            table.tbl_data th, table.tbl_data td { border: 1px solid #333; padding: 4px 6px; }
            table.tbl_data th { background: #f3f4f6; }
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
                    ${settings.alamat}
                  </font>
                </center>
              </td>
              <td width="15%"></td>
            </tr>
          </table>
          <hr/>
          <center><font color="#000000" size="2" face="Tahoma"><b>RINCIAN PEMAKAIAN OBAT/BMHP</b></font></center>
          <div class="info">
            <div>No Rawat : ${target.no_rawat}</div>
            <div>Nama : ${target.nm_pasien}</div>
            <div>No RM : ${target.no_rkm_medis}</div>
            <div>Tanggal : ${target.tanggal}</div>
          </div>
          <table class="tbl_data">
            <thead>
              <tr>
                <th>No.</th>
                <th>Nama Obat dan BMHP</th>
                <th>Satuan</th>
                <th>Jumlah</th>
                <th>Biaya Obat</th>
                <th>Total Biaya</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr>
                <td colspan="5" style="text-align:right"><b>TOTAL</b></td>
                <td style="text-align:right"><b>${fmtAngka(totalBiaya)}</b></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    // Tunggu logo (kalau ada) selesai dimuat sebelum print, supaya tidak
    // ikut ke-print kosong karena race condition gambar belum sempat load.
    printWindow.onload = () => printWindow.print();
  };

  const COLS: { key: keyof DetailPemberianObatItemRow; label: string; align?: 'right' }[] = [
    { key: 'tgl_beri', label: 'Tgl.Beri' },
    { key: 'jam_beri', label: 'Jam Beri' },
    { key: 'no_rawat', label: 'No.Rawat' },
    { key: 'no_rkm_medis', label: 'No.R.M.' },
    { key: 'nm_pasien', label: 'Nama Pasien' },
    { key: 'kode_brng', label: 'Kode Obat' },
    { key: 'nama_brng', label: 'Nama Obat/Alkes' },
    { key: 'embalase', label: 'Embalase', align: 'right' },
    { key: 'tuslah', label: 'Tuslah', align: 'right' },
    { key: 'jml', label: 'Jml', align: 'right' },
    { key: 'biaya_obat', label: 'Biaya Obat', align: 'right' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'h_beli', label: 'Harga Beli', align: 'right' },
    { key: 'gudang', label: 'Gudang' },
    { key: 'no_batch', label: 'No.Batch' },
    { key: 'no_faktur', label: 'No.Faktur' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 1100, maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              Detail Pemberian Obat — {target.nm_pasien} ({target.no_rkm_medis})
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              No. Rawat {target.no_rawat} — {target.tanggal}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCetak}
            disabled={rows.length === 0}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: rows.length === 0 ? '#9ca3af' : '#059669', color: '#ffffff',
              cursor: rows.length === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}
          >
            Cetak
          </button>
        </div>
        <div style={{ marginBottom: 16 }} />

        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} style={{ padding: 8, textAlign: c.align || 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada item obat</td></tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.kode_brng}-${index}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    {COLS.map((c) => {
                      const v = row[c.key];
                      return (
                        <td key={c.key} style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: c.align || 'left', whiteSpace: 'nowrap' }}>
                          {c.key === 'tgl_beri' ? v.toString().slice(0, 10) : typeof v === 'number' ? fmtAngka(v) : v}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export const DetailPemberianObatView: React.FC = () => {
  const [subTab, setSubTab] = React.useState<'ralan' | 'ranap'>('ralan');
  const [tgl1, setTgl1] = React.useState(localDateStr());
  const [tgl2, setTgl2] = React.useState(localDateStr());
  const [kdPj, setKdPj] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [penjabOptions, setPenjabOptions] = React.useState<Penjab[]>([]);
  const [items, setItems] = React.useState<DetailPemberianObatRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [viewingItem, setViewingItem] = React.useState<{ no_rawat: string; tanggal: string; nm_pasien: string; no_rkm_medis: string } | null>(null);

  React.useEffect(() => {
    fetch('/api/pendaftaran/penjab')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPenjabOptions(Array.isArray(data) ? data : []))
      .catch(() => setPenjabOptions([]));
  }, []);

  const fetchData = React.useCallback(async () => {
    if (!tgl1 || !tgl2) return;
    setLoading(true);
    try {
      let url = `/api/apotek/detail-pemberian-obat?kind=${subTab}&tgl1=${tgl1}&tgl2=${tgl2}`;
      if (kdPj) url += `&kd_pj=${encodeURIComponent(kdPj)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [subTab, tgl1, tgl2, kdPj]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayedItems = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.no_rkm_medis, item.nm_pasien, item.nm_dokter, item.nm_lokasi].some((f) => f.toLowerCase().includes(q)));
  }, [items, searchText]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: subTab === t.key ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              color: subTab === t.key ? '#059669' : '#6b7280',
              fontWeight: subTab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ width: 220 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jenis Bayar</label>
          <div style={{ position: 'relative' }}>
            <select value={kdPj} onChange={(e) => setKdPj(e.target.value)} style={pillSelectStyle}>
              <option value="">Semua Jenis Bayar</option>
              {penjabOptions.map((p) => (
                <option key={p.kd_pj} value={p.kd_pj}>{p.nm_pj}</option>
              ))}
            </select>
            <StepperIcon />
          </div>
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={inputStyle} placeholder="No. RM / Nama Pasien / Dokter..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No.</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>{subTab === 'ralan' ? 'Poli' : 'Ruangan'}</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Bayar</th>
              {subTab === 'ranap' && <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : displayedItems.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada pasien yang menerima obat pada tanggal ini</td></tr>
            ) : (
              displayedItems.map((item, index) => (
                <tr key={item.no_resep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#9ca3af' }}>{index + 1}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', color: '#6b7280' }}>{item.no_rawat}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.no_rkm_medis}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_pasien}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_dokter}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nm_lokasi}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.jenis_bayar}</td>
                  {subTab === 'ranap' && (
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setViewingItem({ no_rawat: item.no_rawat, tanggal: item.tgl_penyerahan.slice(0, 10), nm_pasien: item.nm_pasien, no_rkm_medis: item.no_rkm_medis })}
                        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #1AB1E5', background: '#ffffff', color: '#1AB1E5', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        Lihat
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalLihatItemPemberianObat target={viewingItem} onClose={() => setViewingItem(null)} />
    </div>
  );
};
