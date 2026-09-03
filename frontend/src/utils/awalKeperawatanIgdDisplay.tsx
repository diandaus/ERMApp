import React from 'react';

// awalKeperawatanIgdDisplay.tsx — render tabel "Penilaian Awal Keperawatan
// IGD" (kop judul + seksi I-X, sama pengelompokan dgn
// ModalInputAwalKeperawatanIGD.tsx) utk nampilin data yg SUDAH tersimpan,
// konsumsi GET /api/asuhan-keperawatan-igd/{no_rawat} (backend/
// asuhan_keperawatan_igd_handler.go — endpoint ini SATU OBJEK, bukan
// array, krn no_rawat PRIMARY KEY TUNGGAL di penilaian_awal_keperawatan_igd,
// beda dari awalMedisIgdDisplay.tsx yg terima list). Pola file terpisah
// berdiri sendiri sama dgn triaseIgdDisplay.tsx/awalMedisIgdDisplay.tsx.

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

// row2 — 2 sel "Label : Value" sebaris (dipakai berkali2 di bawah).
const row2 = (a: [string, any], b: [string, any]) => (
  <tr>
    <td style={noBorderCellStyle}>{a[0]} : {a[1] || '-'}</td>
    <td style={noBorderCellStyle}>{b[0]} : {b[1] || '-'}</td>
  </tr>
);

// row4 — 4 sel "Label : Value" sebaris.
const row4 = (a: [string, any], b: [string, any], c: [string, any], d: [string, any]) => (
  <tr>
    <td style={noBorderCellStyle}>{a[0]} : {a[1] || '-'}</td>
    <td style={noBorderCellStyle}>{b[0]} : {b[1] || '-'}</td>
    <td style={noBorderCellStyle}>{c[0]} : {c[1] || '-'}</td>
    <td style={noBorderCellStyle}>{d[0]} : {d[1] || '-'}</td>
  </tr>
);

// rowFull — 1 sel "Label : Value" penuh selebar tabel bagian dalam.
const rowFull = (label: string, value: any, colSpan = 4) => (
  <tr>
    <td colSpan={colSpan} style={noBorderCellStyle}>{label} : {value || '-'}</td>
  </tr>
);

export const renderAwalKeperawatanRecord = (d: any) => (
  <table style={nestedTableStyle}>
    <tbody>
      <tr>
        <td style={{ ...cellStyle, background: '#B2EBF2', textAlign: 'center' }}>PENILAIAN AWAL KEPERAWATAN IGD</td>
      </tr>
      <tr>
        <td style={cellStyle}>Tanggal : {d.tanggal || '-'} &nbsp;&nbsp; Petugas : {d.nip} {d.nama_petugas}</td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>I. INFORMASI &amp; RIWAYAT KESEHATAN</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {rowFull('Informasi', d.informasi, 1)}
              {rowFull('Keluhan Utama', d.keluhan_utama, 1)}
              {rowFull('Riwayat Penyakit Dahulu', d.rpd, 1)}
              {rowFull('Riwayat Penggunaan Obat', d.rpo, 1)}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>II. STATUS KEHAMILAN</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {row4(['Status Kehamilan', d.status_kehamilan], ['Gravida', d.gravida], ['Para', d.para], ['Abortus', d.abortus])}
              {rowFull('HPHT', d.hpht, 4)}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>III. PEMERIKSAAN FISIK</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {row2(['Tekanan Intrakranial', d.tekanan], ['Pupil', d.pupil])}
              {row2(['Neurosensorik/Muskuloskeletal', d.neurosensorik], ['Integumen', d.integumen])}
              {row2(['Turgor Kulit', d.turgor], ['Mukosa Mulut', d.mukosa])}
              {row2(['Edema', d.edema], ['Intoksikasi', d.intoksikasi])}
              {row2(['Perdarahan', d.perdarahan], ['Jml Perdarahan (cc)', d.jumlah_perdarahan])}
              {rowFull('Warna Perdarahan', d.warna_perdarahan, 2)}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>IV. ELIMINASI</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {row4(['Frekuensi BAB', d.bab], ['x/', d.xbab], ['Konsistensi BAB', d.kbab], ['Warna BAB', d.wbab])}
              {row4(['Frekuensi BAK', d.bak], ['x/', d.xbak], ['Warna BAK', d.wbak], ['Lain-lain BAK', d.lbak])}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>V. PSIKOSOSIAL</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {row2(['Kondisi Psikologis', d.psikologis], ['Gangguan Jiwa Di Masa Lalu', d.jiwa])}
              {row2(['Adakah Perilaku', d.perilaku], ['Dilaporkan Ke', d.dilaporkan])}
              {rowFull('Sebutkan', d.sebutkan, 2)}
              {rowFull('Hubungan Pasien Dengan Anggota Keluarga', d.hubungan, 2)}
              {row2(['Tinggal Dengan', d.tinggal_dengan], ['Ket. Tinggal Dengan', d.ket_tinggal])}
              {row2(['Nilai-nilai Kebudayaan', d.budaya], ['Ket. Nilai-nilai Kebudayaan', d.ket_budaya])}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>VI. EDUKASI</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {row2(['Pendidikan PJ', d.pendidikan_pj], ['Ket. Pendidikan PJ', d.ket_pendidikan_pj])}
              {row2(['Edukasi Diberikan Kepada', d.edukasi], ['Ket. Edukasi Diberikan Kepada', d.ket_edukasi])}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>VII. KEMAMPUAN AKTIFITAS</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {row2(['Kemampuan Aktifitas Sehari-hari', d.kemampuan], ['Aktifitas', d.aktifitas])}
              {row2(['Alat Bantu', d.alat_bantu], ['Ket. Alat Bantu', d.ket_bantu])}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>VIII. PENGKAJIAN NYERI</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {rowFull('Tingkat Nyeri', d.nyeri, 2)}
              {row2(['Provokes', d.provokes], ['Ket. Provokes', d.ket_provokes])}
              {row2(['Kualitas', d.quality], ['Ket. Kualitas', d.ket_quality])}
              {row2(['Lokasi', d.lokasi], ['Menyebar', d.menyebar])}
              {row2(['Skala Nyeri', d.skala_nyeri], ['Durasi', d.durasi])}
              {row2(['Nyeri Hilang', d.nyeri_hilang], ['Ket. Hilang Nyeri', d.ket_nyeri])}
              {row2(['Lapor Ke Dokter', d.pada_dokter], ['Jam Lapor', d.ket_dokter])}
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td style={cellStyle}>
          <div style={{ marginBottom: 4 }}>IX. PENGKAJIAN RESIKO JATUH (GET UP AND GO)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              <tr>
                <td colSpan={3} style={noBorderCellStyle}>a. Cara Berjalan :</td>
              </tr>
              <tr>
                <td style={noBorderCellStyle}>1. Tidak seimbang / sempoyongan / limbung : {d.berjalan_a || '-'}</td>
                <td colSpan={2} style={noBorderCellStyle}>2. Jalan dengan menggunakan alat bantu (kruk, tripot, kursi roda, orang lain) : {d.berjalan_b || '-'}</td>
              </tr>
              {rowFull('b. Menopang saat akan duduk, tampak memegang pinggiran kursi atau meja / benda lain sebagai penopang', d.berjalan_c, 3)}
              <tr>
                <td style={noBorderCellStyle}>Hasil : {d.hasil || '-'}</td>
                <td style={noBorderCellStyle}>Dilaporkan Kepada Dokter ? : {d.lapor || '-'}</td>
                <td style={noBorderCellStyle}>Jam Dilaporkan : {d.ket_lapor || '-'}</td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {((d.masalah_keperawatan && d.masalah_keperawatan.length > 0) || (d.rencana_keperawatan && d.rencana_keperawatan.length > 0) || d.rencana) && (
        <tr>
          <td style={cellStyle}>
            <div style={{ marginBottom: 4 }}>X. RENCANA KEPERAWATAN</div>
            {d.masalah_keperawatan && d.masalah_keperawatan.length > 0 && (
              <div style={{ fontSize: 13, padding: '2px 6px' }}>
                Masalah Keperawatan : {d.masalah_keperawatan.join(', ')}
              </div>
            )}
            {d.rencana_keperawatan && d.rencana_keperawatan.length > 0 && (
              <div style={{ fontSize: 13, padding: '2px 6px' }}>
                Rencana Keperawatan : {d.rencana_keperawatan.join(', ')}
              </div>
            )}
            {d.rencana && (
              <div style={{ fontSize: 13, padding: '2px 6px' }}>
                Rencana Keperawatan Lainnya : {d.rencana}
              </div>
            )}
          </td>
        </tr>
      )}
    </tbody>
  </table>
);
