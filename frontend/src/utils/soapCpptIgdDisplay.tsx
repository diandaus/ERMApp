import React from 'react';

// soapCpptIgdDisplay.tsx — render tabel SOAP/CPPT (Tanggal | Dokter/
// Paramedis | Profesi/Jabatan/Departemen, lalu Subjek/Objek/vital sign/
// Asesmen/Plan/Inst-Impl/Evaluasi per baris), DIPAKAI oleh
// PemeriksaanIGD.tsx (tab "SOAP/CPPT") utk nampilin data yg sudah
// tersimpan. Mirip renderPemeriksaanTable di RiwayatModal.tsx TAPI TANPA
// kolom "No." (dihapus per permintaan user) — file terpisah berdiri
// sendiri supaya RiwayatModal.tsx tidak ikut berubah sama sekali, pola
// yg sama dgn triaseIgdDisplay.tsx/awalMedisIgdDisplay.tsx. Konsumsi
// bentuk respons GET /api/pemeriksaan-ralan/{no_rawat} (backend/
// pemeriksaan_ralan_handler.go — SUDAH ADA, sama endpoint yg dipakai
// RiwayatModal.tsx, beda dari GET /api/pemeriksaan/soap-history/
// {no_rawat} yg dipakai SoapCpptFormIGD.tsx krn endpoint itu TIDAK join
// nama/jbtn petugas).

const cellStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px 8px',
  verticalAlign: 'top',
  fontSize: 13,
  wordBreak: 'break-word',
};

const headerCellStyle: React.CSSProperties = { ...cellStyle, background: '#eee', textAlign: 'center' };

// vitalCellStyle — sel Suhu/Tensi/Nadi/RR/Tinggi/Berat/SpO2/GCS/
// Kesadaran/L.P., font dikecilkan supaya label 2-baris ("Nadi(/menit)"
// dkk) tetap pas di kolom sempit tanpa meluber.
const vitalHeaderCellStyle: React.CSSProperties = { ...headerCellStyle, fontSize: 10.5, padding: '4px 4px' };
const vitalValueCellStyle: React.CSSProperties = { ...cellStyle, fontSize: 11.5, padding: '4px 4px', textAlign: 'center' };

const nestedTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

// SoapCpptTableActions — Edit/Copy/Hapus per-baris, ditempel rapat (tanpa
// gap, border dibagi) di KOLOM PERTAMA pada baris tepat SETELAH baris
// tanggal (kolom pertama baris Subjek, yg sebelumnya kosong) — per
// permintaan user. Opsional: saat tidak dikasih (mis. kalau file ini
// dipakai murni utk tampilan cetak/riwayat read-only), tabel dirender
// PERSIS spt sebelumnya.
export type SoapCpptTableActions = {
  onEdit: (item: any) => void;
  onCopy: (item: any) => void;
  onDelete: (item: any) => void;
};

// Tombol disatukan jadi satu strip (segmented, solid fill + font putih —
// Edit:warning kuning, Copy:primary biru, Hapus:danger merah) — border
// kanan dihapus kecuali tombol terakhir, marginLeft:-1 (kecuali tombol
// pertama) utk kolaps border ganda, supaya benar-benar "tempel rapat".
const actionBtnStyle = (bg: string, isFirst: boolean, isLast: boolean): React.CSSProperties => ({
  padding: '2px 7px', borderRadius: 0, border: `1px solid ${bg}`,
  borderRight: isLast ? `1px solid ${bg}` : 'none',
  marginLeft: isFirst ? 0 : -1,
  background: bg, color: '#fff', cursor: 'pointer', fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap',
});

export const renderSoapCpptTable = (list: any[], actions?: SoapCpptTableActions) => {
  if (!list || list.length === 0) return null;
  return (
    <table style={nestedTableStyle}>
      <tbody>
        <tr>
          <td style={{ ...headerCellStyle, width: '15%' }}>Tanggal</td>
          <td colSpan={7} style={headerCellStyle}>Dokter/Paramedis</td>
          <td colSpan={3} style={headerCellStyle}>Profesi/Jabatan/Departemen</td>
        </tr>
        {list.map((d: any, i: number) => (
          <React.Fragment key={i}>
            <tr>
              <td style={{ ...cellStyle, fontSize: 11.5, whiteSpace: 'nowrap' }}>{d.tgl_perawatan} {d.jam_rawat}</td>
              <td colSpan={7} style={cellStyle}>{d.nip} {d.nama}</td>
              <td colSpan={3} style={cellStyle}>{d.jbtn}</td>
            </tr>
            {(d.keluhan || actions) && (
              <tr>
                <td style={cellStyle}>
                  {actions && (
                    <div style={{ display: 'flex' }}>
                      <button type="button" onClick={() => actions.onEdit(d)} title="Edit" style={actionBtnStyle('#f59e0b', true, false)}>Edit</button>
                      <button type="button" onClick={() => actions.onCopy(d)} title="Copy ke form (entri baru)" style={actionBtnStyle('#2563eb', false, false)}>Copy</button>
                      <button type="button" onClick={() => actions.onDelete(d)} title="Hapus" style={actionBtnStyle('#ef4444', false, true)}>Hapus</button>
                    </div>
                  )}
                </td>
                <td colSpan={2} style={cellStyle}>Subjek</td>
                <td colSpan={8} style={cellStyle}>: {d.keluhan || '-'}</td>
              </tr>
            )}
            {d.pemeriksaan && (
              <tr>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Objek</td>
                <td colSpan={8} style={cellStyle}>: {d.pemeriksaan}</td>
              </tr>
            )}
            <tr>
              <td style={cellStyle}></td>
              {['Suhu(C)', 'Tensi', 'Nadi(/menit)', 'RR(/menit)', 'Tinggi(Cm)', 'Berat(Kg)', 'SpO2(%)', 'GCS(E,V,M)', 'Kesadaran', 'L.P.(Cm)'].map((h) => (
                <td key={h} style={vitalHeaderCellStyle}>{h}</td>
              ))}
            </tr>
            <tr>
              <td style={cellStyle}></td>
              <td style={vitalValueCellStyle}>{d.suhu_tubuh}</td>
              <td style={vitalValueCellStyle}>{d.tensi}</td>
              <td style={vitalValueCellStyle}>{d.nadi}</td>
              <td style={vitalValueCellStyle}>{d.respirasi}</td>
              <td style={vitalValueCellStyle}>{d.tinggi}</td>
              <td style={vitalValueCellStyle}>{d.berat}</td>
              <td style={vitalValueCellStyle}>{d.spo2}</td>
              <td style={vitalValueCellStyle}>{d.gcs}</td>
              <td style={vitalValueCellStyle}>{d.kesadaran}</td>
              <td style={vitalValueCellStyle}>{d.lingkar_perut}</td>
            </tr>
            {d.alergi && (
              <tr>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Alergi</td>
                <td colSpan={8} style={cellStyle}>: {d.alergi}</td>
              </tr>
            )}
            {d.penilaian && (
              <tr>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Asesmen</td>
                <td colSpan={8} style={cellStyle}>: {d.penilaian}</td>
              </tr>
            )}
            {d.rtl && (
              <tr>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Plan</td>
                <td colSpan={8} style={cellStyle}>: {d.rtl}</td>
              </tr>
            )}
            {d.instruksi && (
              <tr>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Inst/Impl</td>
                <td colSpan={8} style={cellStyle}>: {d.instruksi}</td>
              </tr>
            )}
            {d.evaluasi && (
              <tr>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Evaluasi</td>
                <td colSpan={8} style={cellStyle}>: {d.evaluasi}</td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};
