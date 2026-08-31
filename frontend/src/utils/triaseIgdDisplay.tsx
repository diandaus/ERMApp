import React from 'react';

// triaseIgdDisplay.tsx — render tabel Triase Primer/Sekunder (label :
// value, baris skala berwarna sesuai tingkat kegawatan), DIPAKAI BERSAMA
// oleh RiwayatModal.tsx (histori) dan PemeriksaanIGD.tsx (tab Triase,
// tampilan data tersimpan) — SEBELUMNYA duplikat persis di kedua file,
// dipindah ke sini supaya satu sumber kebenaran & selalu konsisten
// tampilannya. Konsumsi bentuk respons GET /api/triase-igd/{no_rawat}
// (backend/riwayat_handler.go: TriaseIGDPrimerDetail/TriaseIGDSekunderDetail).

const cellStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px 8px',
  verticalAlign: 'top',
  fontSize: 13,
  wordBreak: 'break-word',
};

const nestedTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

// Baris skala berwarna sesuai tingkat kegawatan (1=paling gawat)
const triaseSkalaInfo: Record<number, { bg: string; label: string }> = {
  1: { bg: '#AA0000', label: 'Immediate/Segera' },
  2: { bg: '#FF0000', label: 'Emergensi' },
  3: { bg: '#C8C800', label: 'Urgensi' },
  4: { bg: '#00AA00', label: 'Semi Urgensi/Urgensi Rendah' },
  5: { bg: '#969696', label: 'Non Urgensi' },
};

const renderTriaseSkalaRows = (skalaNum: number, items: any[]) => {
  if (!items || items.length === 0) return null;
  const { bg, label } = triaseSkalaInfo[skalaNum];
  return (
    <React.Fragment>
      <tr>
        <td style={{ ...cellStyle, background: '#eee', textAlign: 'center' }}>Pemeriksaan</td>
        <td style={{ ...cellStyle, background: bg, color: '#fff', textAlign: 'center' }}>{label}</td>
      </tr>
      {items.map((item: any, i: number) => (
        <tr key={i}>
          <td style={cellStyle}>{item.nama_pemeriksaan}</td>
          <td style={{ ...cellStyle, background: bg, color: '#fff' }}>
            {(item.details || []).map((d: any, j: number) => (
              <div key={j}>{d[`pengkajian_skala${skalaNum}`]}</div>
            ))}
          </td>
        </tr>
      ))}
    </React.Fragment>
  );
};

export const renderTriasePrimer = (t: any) => {
  if (!t) return null;
  let keputusan = '#969696';
  if (t.skala1?.length > 0) keputusan = '#AA0000';
  if (t.skala2?.length > 0) keputusan = '#FF0000';
  return (
    <table style={nestedTableStyle}>
      <colgroup>
        <col style={{ width: '28%' }} />
        <col />
      </colgroup>
      <tbody>
        <tr><td style={cellStyle}>Cara Masuk</td><td style={cellStyle}>: {t.cara_masuk}</td></tr>
        <tr><td style={cellStyle}>Transportasi</td><td style={cellStyle}>: {t.alat_transportasi}</td></tr>
        <tr><td style={cellStyle}>Alasan Kedatangan</td><td style={cellStyle}>: {t.alasan_kedatangan}</td></tr>
        <tr><td style={cellStyle}>Keterangan Kedatangan</td><td style={cellStyle}>: {t.keterangan_kedatangan}</td></tr>
        <tr><td style={cellStyle}>Macam Kasus</td><td style={cellStyle}>: {t.macam_kasus}</td></tr>
        <tr>
          <td style={{ ...cellStyle, background: '#eee', textAlign: 'center', width: '35%' }}>Keterangan</td>
          <td style={{ ...cellStyle, background: '#eee', textAlign: 'center' }}>Triase Primer</td>
        </tr>
        <tr><td style={cellStyle}>Keluhan Utama</td><td style={cellStyle}>{t.keluhan_utama}</td></tr>
        <tr>
          <td style={cellStyle}>Tanda Vital</td>
          <td style={cellStyle}>Suhu (C) : {t.suhu}, Nyeri : {t.nyeri}, Tensi : {t.tekanan_darah}, Nadi(/menit) : {t.nadi}, Saturasi O²(%) : {t.saturasi_o2}, Respirasi(/menit) : {t.pernapasan}</td>
        </tr>
        <tr><td style={cellStyle}>Kebutuhan Khusus</td><td style={cellStyle}>{t.kebutuhan_khusus}</td></tr>
        {renderTriaseSkalaRows(1, t.skala1)}
        {renderTriaseSkalaRows(2, t.skala2)}
        <tr>
          <td style={cellStyle}>Plan/Keputusan</td>
          <td style={{ ...cellStyle, background: keputusan, color: '#fff' }}>Zona Merah {t.plan}</td>
        </tr>
        <tr>
          <td style={cellStyle}>&nbsp;</td>
          <td style={{ ...cellStyle, background: '#eee', textAlign: 'center' }}>Petugas Triase Primer</td>
        </tr>
        <tr><td style={cellStyle}>Tanggal & Jam</td><td style={cellStyle}>{t.tanggaltriase}</td></tr>
        <tr><td style={cellStyle}>Catatan</td><td style={cellStyle}>{t.catatan}</td></tr>
        <tr><td style={cellStyle}>Dokter/Petugas IGD</td><td style={cellStyle}>{t.nik} {t.nama}</td></tr>
      </tbody>
    </table>
  );
};

export const renderTriaseSekunder = (t: any) => {
  if (!t) return null;
  let keputusan = '#969696';
  if (t.skala3?.length > 0) keputusan = '#C8C800';
  if (t.skala4?.length > 0) keputusan = '#00AA00';
  if (t.skala5?.length > 0) keputusan = '#969696';
  return (
    <table style={nestedTableStyle}>
      <colgroup>
        <col style={{ width: '28%' }} />
        <col />
      </colgroup>
      <tbody>
        <tr><td style={cellStyle}>Cara Masuk</td><td style={cellStyle}>: {t.cara_masuk}</td></tr>
        <tr><td style={cellStyle}>Transportasi</td><td style={cellStyle}>: {t.alat_transportasi}</td></tr>
        <tr><td style={cellStyle}>Alasan Kedatangan</td><td style={cellStyle}>: {t.alasan_kedatangan}</td></tr>
        <tr><td style={cellStyle}>Keterangan Kedatangan</td><td style={cellStyle}>: {t.keterangan_kedatangan}</td></tr>
        <tr><td style={cellStyle}>Macam Kasus</td><td style={cellStyle}>: {t.macam_kasus}</td></tr>
        <tr>
          <td style={{ ...cellStyle, background: '#eee', textAlign: 'center', width: '35%' }}>Keterangan</td>
          <td style={{ ...cellStyle, background: '#eee', textAlign: 'center' }}>Triase Sekunder</td>
        </tr>
        <tr><td style={cellStyle}>Anamnesa Singkat</td><td style={cellStyle}>{t.anamnesa_singkat}</td></tr>
        <tr>
          <td style={cellStyle}>Tanda Vital</td>
          <td style={cellStyle}>Suhu (C) : {t.suhu}, Nyeri : {t.nyeri}, Tensi : {t.tekanan_darah}, Nadi(/menit) : {t.nadi}, Saturasi O²(%) : {t.saturasi_o2}, Respirasi(/menit) : {t.pernapasan}</td>
        </tr>
        {renderTriaseSkalaRows(3, t.skala3)}
        {renderTriaseSkalaRows(4, t.skala4)}
        {renderTriaseSkalaRows(5, t.skala5)}
        <tr>
          <td style={cellStyle}>Plan/Keputusan</td>
          <td style={{ ...cellStyle, background: keputusan, color: '#fff' }}>{t.plan}</td>
        </tr>
        <tr>
          <td style={cellStyle}>&nbsp;</td>
          <td style={{ ...cellStyle, background: '#eee', textAlign: 'center' }}>Petugas Triase Sekunder</td>
        </tr>
        <tr><td style={cellStyle}>Tanggal & Jam</td><td style={cellStyle}>{t.tanggaltriase}</td></tr>
        <tr><td style={cellStyle}>Catatan</td><td style={cellStyle}>{t.catatan}</td></tr>
        <tr><td style={cellStyle}>Dokter/Petugas IGD</td><td style={cellStyle}>{t.nik} {t.nama}</td></tr>
      </tbody>
    </table>
  );
};
