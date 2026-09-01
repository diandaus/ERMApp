import React from 'react';

// awalMedisIgdDisplay.tsx — render tabel "Penilaian Awal Medis IGD" (kop
// judul + seksi I-VI), DIPAKAI oleh PemeriksaanIGD.tsx (tab "Awal Medis")
// utk nampilin data yg SUDAH tersimpan (endpoint read-only GET
// /api/asuhan-medis-igd/{no_rawat}, backend/asuhan_medis_handler.go —
// BELUM ada endpoint simpan, form input menyusul kemudian). Seksi I-VI
// adalah DUPLIKAT PERSIS renderAwalMedisIGD di RiwayatModal.tsx — file
// terpisah berdiri sendiri (bukan reuse import) supaya RiwayatModal.tsx
// tidak ikut berubah sama sekali, pola yg sama dgn triaseIgdDisplay.tsx.
// TIDAK ada baris No.RM/Nama Pasien/JK/Tgl.Lahir di sini (beda dari
// referensi cetak Khanza Desktop) — info itu sudah tampil di sidebar
// PemeriksaanIGD.tsx, jadi sengaja tidak diulang (per permintaan user).

const cellStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px 8px',
  verticalAlign: 'top',
  fontSize: 13,
  wordBreak: 'break-word',
};

const noBorderCellStyle: React.CSSProperties = { padding: '4px 6px', fontSize: 13, verticalAlign: 'top', wordBreak: 'break-word' };

const nestedTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

export const renderAwalMedisRecord = (d: any) => (
  <table style={nestedTableStyle}>
    <tbody>
      <tr>
        <td colSpan={3} style={{ ...cellStyle, background: '#B2EBF2', textAlign: 'center' }}>PENILAIAN AWAL MEDIS IGD</td>
      </tr>
      <tr>
        <td style={cellStyle}>Tanggal : {d.tanggal || '-'}</td>
        <td colSpan={2} style={cellStyle}>Anamnesis : {d.anamnesis || '-'}{d.hubungan ? `, ${d.hubungan}` : ''}</td>
      </tr>
      <tr>
        <td colSpan={3} style={cellStyle}>
          <div style={{ marginBottom: 4 }}>I. RIWAYAT KESEHATAN</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              <tr><td colSpan={2} style={noBorderCellStyle}>Keluhan Utama : {d.keluhan_utama}</td></tr>
              <tr><td colSpan={2} style={noBorderCellStyle}>Riwayat Penyakit Sekarang : {d.rps}</td></tr>
              <tr>
                <td style={noBorderCellStyle}>Riwayat Penyakit Dahulu : {d.rpd}</td>
                <td style={noBorderCellStyle}>Riwayat Alergi : {d.alergi}</td>
              </tr>
              <tr>
                <td style={noBorderCellStyle}>Riwayat Penyakit Keluarga : {d.rpk}</td>
                <td style={noBorderCellStyle}>Riwayat Penggunaan Obat : {d.rpo}</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={cellStyle}>
          <div style={{ marginBottom: 4 }}>II. PEMERIKSAAN FISIK</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              <tr>
                <td style={noBorderCellStyle}>Keadaan Umum : {d.keadaan}</td>
                <td style={noBorderCellStyle}>Kesadaran : {d.kesadaran}</td>
                <td style={noBorderCellStyle}>GCS(E,V,M) : {d.gcs}</td>
                <td style={noBorderCellStyle}>TB : {d.tb} Cm</td>
              </tr>
              <tr>
                <td style={noBorderCellStyle}>BB : {d.bb} Kg</td>
                <td style={noBorderCellStyle}>TD : {d.td} mmHg</td>
                <td style={noBorderCellStyle}>Nadi : {d.nadi} x/menit</td>
                <td style={noBorderCellStyle}>RR : {d.rr} x/menit</td>
              </tr>
              <tr>
                <td style={noBorderCellStyle}>Suhu : {d.suhu} °C</td>
                <td style={noBorderCellStyle}>SpO2 : {d.spo} %</td>
                <td style={noBorderCellStyle}>Kepala : {d.kepala}</td>
                <td style={noBorderCellStyle}>Mata : {d.mata}</td>
              </tr>
              <tr>
                <td style={noBorderCellStyle}>Gigi & Mulut : {d.gigi}</td>
                <td style={noBorderCellStyle}>Leher : {d.leher}</td>
                <td style={noBorderCellStyle}>Thoraks : {d.thoraks}</td>
                <td style={noBorderCellStyle}>Abdomen : {d.abdomen}</td>
              </tr>
              <tr>
                <td style={noBorderCellStyle}>Genital & Anus : {d.genital}</td>
                <td style={noBorderCellStyle}>Ekstremitas : {d.ekstremitas}</td>
                <td colSpan={2} style={noBorderCellStyle}>Keterangan Fisik : {d.ket_fisik}</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={cellStyle}>
          <div style={{ marginBottom: 4 }}>III. STATUS LOKALIS</div>
          <div style={{ ...noBorderCellStyle, textAlign: 'center' }}>
            <img src="/asuhan-medis-igd/semua.png" alt="Gambar Lokalis" style={{ width: '100%', maxWidth: 500, height: 'auto' }} />
          </div>
          <div style={noBorderCellStyle}>Keterangan : {d.ket_lokalis}</div>
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={cellStyle}>
          <div style={{ marginBottom: 4 }}>IV. PEMERIKSAAN PENUNJANG</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              <tr>
                <td style={noBorderCellStyle}>EKG : {d.ekg}</td>
                <td style={noBorderCellStyle}>Radiologi : {d.rad}</td>
                <td style={noBorderCellStyle}>Laborat : {d.lab}</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={cellStyle}>
          <div style={{ marginBottom: 4 }}>V. DIAGNOSIS/ASESMEN</div>
          <div style={noBorderCellStyle}>{d.diagnosis}</div>
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={cellStyle}>
          <div style={{ marginBottom: 4 }}>VI. TATALAKSANA</div>
          <div style={noBorderCellStyle}>{d.tata}</div>
        </td>
      </tr>
    </tbody>
  </table>
);
