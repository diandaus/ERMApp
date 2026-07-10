import React from 'react';
import { khanzaRadiologiUrl } from '../utils/khanzaUrl';

type RiwayatModalProps = {
  patient: any;
  onClose: () => void;
};

// Sebagian endpoint mengembalikan tanggal dalam format ISO (2023-12-19T00:00:00+07:00);
// ambil bagian tanggalnya saja dan format ke DD/MM/YYYY agar konsisten dengan endpoint lain.
const formatTgl = (tgl: string): string => {
  if (!tgl) return '';
  if (tgl.includes('T')) {
    const datePart = tgl.split('T')[0];
    const [y, m, d] = datePart.split('-');
    return y && m && d ? `${d}/${m}/${y}` : datePart;
  }
  return tgl;
};

const cellStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px 8px',
  verticalAlign: 'top',
  fontSize: 13,
};

const labelCellStyle: React.CSSProperties = { ...cellStyle, width: '20%' };
const colonCellStyle: React.CSSProperties = { ...cellStyle, width: '1%', textAlign: 'center' };
const valueCellStyle: React.CSSProperties = { ...cellStyle, width: '79%' };
const headerCellStyle: React.CSSProperties = { ...cellStyle, background: '#eee', fontWeight: 600, textAlign: 'center' };
const noBorderCellStyle: React.CSSProperties = { padding: '4px 6px', fontSize: 13, verticalAlign: 'top' };

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: 20,
};

const nestedTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const sectionTitleStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontWeight: 500,
  fontSize: 15,
  margin: '24px 0 12px',
};

// Baris label : value standar (mengikuti pola tbl_form)
const Row: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <tr>
    <td style={labelCellStyle}>{label}</td>
    <td style={colonCellStyle}>:</td>
    <td style={valueCellStyle}>{children}</td>
  </tr>
);

const IcdTable: React.FC<{ headers: string[]; rows: (string | number)[][] }> = ({ headers, rows }) => (
  <table style={nestedTableStyle}>
    <tbody>
      <tr>
        {headers.map((h) => (
          <td key={h} style={headerCellStyle}>{h}</td>
        ))}
      </tr>
      {rows.map((r, i) => (
        <tr key={i}>
          {r.map((c, j) => (
            <td key={j} style={cellStyle}>{c}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

// Triase IGD (Primer & Sekunder) — baris skala berwarna sesuai tingkat kegawatan
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

const renderTriasePrimer = (t: any) => {
  if (!t) return null;
  let keputusan = '#969696';
  if (t.skala1?.length > 0) keputusan = '#AA0000';
  if (t.skala2?.length > 0) keputusan = '#FF0000';
  return (
    <table style={nestedTableStyle}>
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

const renderTriaseSekunder = (t: any) => {
  if (!t) return null;
  let keputusan = '#969696';
  if (t.skala3?.length > 0) keputusan = '#C8C800';
  if (t.skala4?.length > 0) keputusan = '#00AA00';
  if (t.skala5?.length > 0) keputusan = '#969696';
  return (
    <table style={nestedTableStyle}>
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

// Pengkajian Awal Medis IGD (YANG MELAKUKAN PENGKAJIAN, I-VI)
const renderAwalMedisIGD = (list: any[]) => {
  if (!list || list.length === 0) return null;
  return (
    <table style={nestedTableStyle}>
      <tbody>
        {list.map((d: any, i: number) => (
          <React.Fragment key={i}>
            <tr>
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>YANG MELAKUKAN PENGKAJIAN</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={noBorderCellStyle}>Tanggal : {d.tanggal}</td>
                      <td style={noBorderCellStyle}>Dokter : {d.kd_dokter} {d.nm_dokter}</td>
                      <td style={noBorderCellStyle}>Anamnesis : {d.anamnesis}{d.hubungan ? `, ${d.hubungan}` : ''}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>I. RIWAYAT KESEHATAN</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>II. PEMERIKSAAN FISIK</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>III. STATUS LOKALIS</div>
                <div style={{ ...noBorderCellStyle, textAlign: 'center' }}>
                  <img src="/asuhan-medis-igd/semua.png" alt="Gambar Lokalis" style={{ width: '100%', maxWidth: 500, height: 'auto' }} />
                </div>
                <div style={noBorderCellStyle}>Keterangan : {d.ket_lokalis}</div>
              </td>
            </tr>
            <tr>
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>IV. PEMERIKSAAN PENUNJANG</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>V. DIAGNOSIS/ASESMEN</div>
                <div style={noBorderCellStyle}>{d.diagnosis}</div>
              </td>
            </tr>
            <tr>
              <td style={cellStyle}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>VI. TATALAKSANA</div>
                <div style={noBorderCellStyle}>{d.tata}</div>
              </td>
            </tr>
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};

// Tabel SOAP (dipakai terpisah untuk Pemeriksaan Rawat Jalan & Pemeriksaan Rawat Inap)
const renderPemeriksaanTable = (list: any[]) => {
  if (!list || list.length === 0) return null;
  return (
    <table style={nestedTableStyle}>
      <tbody>
        <tr>
          <td style={{ ...headerCellStyle, width: '4%' }}>No.</td>
          <td style={{ ...headerCellStyle, width: '15%' }}>Tanggal</td>
          <td colSpan={7} style={headerCellStyle}>Dokter/Paramedis</td>
          <td colSpan={3} style={headerCellStyle}>Profesi/Jabatan/Departemen</td>
        </tr>
        {list.map((d: any, i: number) => (
          <React.Fragment key={i}>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
              <td style={cellStyle}>{d.tgl_perawatan} {d.jam_rawat}</td>
              <td colSpan={7} style={cellStyle}>{d.nip} {d.nama}</td>
              <td colSpan={3} style={cellStyle}>{d.jbtn}</td>
            </tr>
            {d.keluhan && (
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Subjek</td>
                <td colSpan={8} style={cellStyle}>: {d.keluhan}</td>
              </tr>
            )}
            {d.pemeriksaan && (
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Objek</td>
                <td colSpan={8} style={cellStyle}>: {d.pemeriksaan}</td>
              </tr>
            )}
            <tr>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              {['Suhu(C)', 'Tensi', 'Nadi(/menit)', 'Respirasi(/menit)', 'Tinggi(Cm)', 'Berat(Kg)', 'SpO2(%)', 'GCS(E,V,M)', 'Kesadaran', 'L.P.(Cm)'].map((h) => (
                <td key={h} style={headerCellStyle}>{h}</td>
              ))}
            </tr>
            <tr>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.suhu_tubuh}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.tensi}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.nadi}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.respirasi}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.tinggi}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.berat}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.spo2}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.gcs}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.kesadaran}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{d.lingkar_perut}</td>
            </tr>
            {d.alergi && (
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Alergi</td>
                <td colSpan={8} style={cellStyle}>: {d.alergi}</td>
              </tr>
            )}
            {d.penilaian && (
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Asesmen</td>
                <td colSpan={8} style={cellStyle}>: {d.penilaian}</td>
              </tr>
            )}
            {d.rtl && (
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Plan</td>
                <td colSpan={8} style={cellStyle}>: {d.rtl}</td>
              </tr>
            )}
            {d.instruksi && (
              <tr>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td colSpan={2} style={cellStyle}>Inst/Impl</td>
                <td colSpan={8} style={cellStyle}>: {d.instruksi}</td>
              </tr>
            )}
            {d.evaluasi && (
              <tr>
                <td style={cellStyle}></td>
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

// Sub-tabel tindakan (dokter / paramedis / dokter & paramedis)
const renderTindakanSub = (title: string, items: any[], cols: ('dokter' | 'paramedis')[]) => {
  if (!items || items.length === 0) return null;
  return (
    <table style={{ ...nestedTableStyle, marginBottom: 2 }}>
      <tbody>
        <tr>
          <td colSpan={3 + cols.length} style={cellStyle}>{title}</td>
        </tr>
        <tr>
          <td style={headerCellStyle}>Tanggal</td>
          <td style={headerCellStyle}>Kode</td>
          <td style={headerCellStyle}>Nama Tindakan/Perawatan</td>
          {cols.includes('dokter') && <td style={headerCellStyle}>Dokter</td>}
          {cols.includes('paramedis') && <td style={headerCellStyle}>Perawat</td>}
        </tr>
        {items.map((it: any, i: number) => (
          <tr key={i}>
            <td style={cellStyle}>{formatTgl(it.tgl_perawatan)} {it.jam_rawat}</td>
            <td style={cellStyle}>{it.kd_jenis_prw}</td>
            <td style={cellStyle}>{it.nm_perawatan}</td>
            {cols.includes('dokter') && <td style={cellStyle}>{it.nm_dokter}</td>}
            {cols.includes('paramedis') && <td style={cellStyle}>{it.nama_paramedis}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const renderTindakan = (tindakanData: any) => {
  if (!tindakanData) return null;
  const hasDokter = tindakanData.tindakan_dokter?.length > 0;
  const hasParamedis = tindakanData.tindakan_paramedis?.length > 0;
  const hasBoth = tindakanData.tindakan_dokter_paramedis?.length > 0;
  if (!hasDokter && !hasParamedis && !hasBoth) return null;
  return (
    <>
      {renderTindakanSub('Tindakan Dokter', tindakanData.tindakan_dokter, ['dokter'])}
      {renderTindakanSub('Tindakan Perawat', tindakanData.tindakan_paramedis, ['paramedis'])}
      {renderTindakanSub('Tindakan Dokter & Perawat', tindakanData.tindakan_dokter_paramedis, ['dokter', 'paramedis'])}
    </>
  );
};

// Kelompokkan pemberian obat per tanggal+jam (mengikuti pola PHP: nested table per resep)
const groupObat = (list: any[]) => {
  const map = new Map<string, { tgl_perawatan: string; jam: string; items: any[] }>();
  list.forEach((item) => {
    const key = `${item.tgl_perawatan}|${item.jam}`;
    if (!map.has(key)) map.set(key, { tgl_perawatan: item.tgl_perawatan, jam: item.jam, items: [] });
    map.get(key)!.items.push(item);
  });
  return Array.from(map.values());
};

const renderObat = (obatData: any, statusLanjut: string) => {
  const list = obatData?.pemberian_obat;
  if (!list || list.length === 0) return null;
  const grouped = groupObat(list);
  return (
    <table style={nestedTableStyle}>
      <tbody>
        <tr>
          <td style={headerCellStyle}>Tanggal</td>
          <td style={headerCellStyle}>Detail Resep</td>
        </tr>
        {grouped.map((g, i) => (
          <tr key={i}>
            <td style={cellStyle}>{g.tgl_perawatan} {g.jam}<br />{statusLanjut}</td>
            <td style={{ ...cellStyle, padding: 0 }}>
              <table style={nestedTableStyle}>
                <tbody>
                  <tr>
                    <td style={headerCellStyle}>Nama Obat</td>
                    <td style={headerCellStyle}>Jumlah</td>
                  </tr>
                  {g.items.map((it: any, j: number) => (
                    <tr key={j}>
                      <td style={cellStyle}>{it.nama_brng}</td>
                      <td style={cellStyle}>{it.jml}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// Radiologi — 3 sub-tabel terpisah: Pemeriksaan, Bacaan/Hasil, Gambar
const renderRadiologi = (radData: any) => {
  if (!radData) return null;
  const hasPemeriksaan = radData.pemeriksaan?.length > 0;
  const hasHasil = radData.hasil?.length > 0;
  const hasGambar = radData.gambar?.length > 0;
  if (!hasPemeriksaan && !hasHasil && !hasGambar) return null;

  return (
    <>
      {hasPemeriksaan && (
        <table style={{ ...nestedTableStyle, marginBottom: 8 }}>
          <tbody>
            <tr><td colSpan={7} style={cellStyle}>Pemeriksaan Radiologi</td></tr>
            <tr>
              <td style={{ ...headerCellStyle, width: '4%' }}>No.</td>
              <td style={{ ...headerCellStyle, width: '15%' }}>Tanggal</td>
              <td style={{ ...headerCellStyle, width: '10%' }}>Kode</td>
              <td style={{ ...headerCellStyle, width: '26%' }}>Nama Pemeriksaan</td>
              <td style={{ ...headerCellStyle, width: '18%' }}>Dokter PJ</td>
              <td style={{ ...headerCellStyle, width: '17%' }}>Petugas</td>
              <td style={{ ...headerCellStyle, width: '10%' }}>Biaya</td>
            </tr>
            {radData.pemeriksaan.map((p: any, i: number) => (
              <tr key={i}>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
                <td style={cellStyle}>{p.tgl_periksa} {p.jam}</td>
                <td style={cellStyle}>{p.kd_jenis_prw}</td>
                <td style={cellStyle}>{p.nm_perawatan}{p.proyeksi ? <><br />{p.proyeksi}</> : null}</td>
                <td style={cellStyle}>{p.nm_dokter}</td>
                <td style={cellStyle}>{p.nama_petugas}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{Number(p.biaya || 0).toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hasHasil && (
        <table style={{ ...nestedTableStyle, marginBottom: 8 }}>
          <tbody>
            <tr><td colSpan={3} style={cellStyle}>Bacaan/Hasil Radiologi</td></tr>
            <tr>
              <td style={{ ...headerCellStyle, width: '4%' }}>No.</td>
              <td style={{ ...headerCellStyle, width: '15%' }}>Tanggal</td>
              <td style={{ ...headerCellStyle, width: '81%' }}>Hasil Pemeriksaan</td>
            </tr>
            {radData.hasil.map((h: any, i: number) => (
              <tr key={i}>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
                <td style={cellStyle}>{h.tgl_periksa} {h.jam}</td>
                <td style={cellStyle}>{h.hasil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hasGambar && (
        <table style={nestedTableStyle}>
          <tbody>
            <tr><td colSpan={3} style={cellStyle}>Gambar Radiologi</td></tr>
            <tr>
              <td style={{ ...headerCellStyle, width: '4%' }}>No.</td>
              <td style={{ ...headerCellStyle, width: '15%' }}>Tanggal</td>
              <td style={{ ...headerCellStyle, width: '81%' }}>Gambar Radiologi</td>
            </tr>
            {radData.gambar.map((g: any, i: number) => (
              <tr key={i}>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
                <td style={cellStyle}>{g.tgl_periksa} {g.jam}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  <a href={khanzaRadiologiUrl(g.lokasi_gambar)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={khanzaRadiologiUrl(g.lokasi_gambar)}
                      alt="Gambar Radiologi"
                      style={{ width: 300, height: 300, objectFit: 'contain' }}
                    />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
};

// Ratakan grup lab_pkmb (per tanggal, per item pemeriksaan) menjadi list flat
const flattenLab = (labData: any) => {
  const out: { tgl_periksa: string; nm_perawatan: string; detail: any[] }[] = [];
  (labData?.lab_pkmb || []).forEach((group: any) => {
    (group.items || []).forEach((item: any) => {
      out.push({
        tgl_periksa: `${group.tgl_periksa} ${group.jam}`,
        nm_perawatan: item.nm_perawatan,
        detail: item.detail_items || [],
      });
    });
  });
  return out;
};

const renderLaboratorium = (labData: any) => {
  const flat = flattenLab(labData);
  if (flat.length === 0) return null;
  return (
    <table style={nestedTableStyle}>
      <tbody>
        <tr>
          {['Tanggal', 'Nama Tindakan', 'Hasil', 'Nilai Rujukan', 'Keterangan'].map((h) => (
            <td key={h} style={headerCellStyle}>{h}</td>
          ))}
        </tr>
        {flat.map((g, i) => (
          <React.Fragment key={i}>
            <tr>
              <td style={cellStyle}>{g.tgl_periksa}</td>
              <td colSpan={4} style={cellStyle}>{g.nm_perawatan}</td>
            </tr>
            {g.detail.map((d: any, j: number) => (
              <tr key={j}>
                <td style={cellStyle}></td>
                <td style={cellStyle}>{d.pemeriksaan}</td>
                <td style={cellStyle}>{d.nilai} {d.satuan}</td>
                <td style={cellStyle}>{d.nilai_rujukan}</td>
                <td style={cellStyle}>{d.keterangan}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};

export const RiwayatModal: React.FC<RiwayatModalProps> = ({ patient, onClose }) => {
  const [bio, setBio] = React.useState<any>(null);
  const [riwayat, setRiwayat] = React.useState<any[]>([]);
  const [detailMap, setDetailMap] = React.useState<Map<string, any>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const load = async () => {
      if (!patient?.no_rkm_medis) {
        setError('Data pasien tidak lengkap');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/riwayat-perawatan/${encodeURIComponent(patient.no_rkm_medis)}`);
        if (!res.ok) throw new Error('Gagal memuat riwayat perawatan');
        const data = await res.json();
        setBio(data.pasien || null);
        const list = Array.isArray(data.riwayat) ? data.riwayat : [];
        setRiwayat(list);

        const newMap = new Map<string, any>();
        await Promise.all(
          list.map(async (item: any) => {
            const noRawat = item.no_rawat;
            const fetchJson = async (url: string, fallback: any) => {
              try {
                const r = await fetch(url);
                return r.ok ? await r.json() : fallback;
              } catch {
                return fallback;
              }
            };
            const [triaseIgd, asuhanMedisIGD, pemeriksaanRalan, pemeriksaanRanap, tindakanRalan, tindakanRanap, obat, radiologi, laboratorium] = await Promise.all([
              fetchJson(`/api/triase-igd/${noRawat}`, null),
              fetchJson(`/api/asuhan-medis-igd/${noRawat}`, []),
              fetchJson(`/api/pemeriksaan-ralan/${noRawat}`, []),
              fetchJson(`/api/pemeriksaan-ranap/${noRawat}`, []),
              fetchJson(`/api/tindakan-ralan/${noRawat}`, null),
              fetchJson(`/api/tindakan-ranap/${noRawat}`, null),
              fetchJson(`/api/obat-data/${noRawat}`, null),
              fetchJson(`/api/radiologi-data/${noRawat}`, null),
              fetchJson(`/api/laboratorium/${noRawat}`, null),
            ]);
            newMap.set(noRawat, {
              triasePrimer: triaseIgd?.triase_primer || null,
              triaseSekunder: triaseIgd?.triase_sekunder || null,
              asuhanMedisIGD: Array.isArray(asuhanMedisIGD) ? asuhanMedisIGD : [],
              pemeriksaanRalan: Array.isArray(pemeriksaanRalan) ? pemeriksaanRalan : [],
              pemeriksaanRanap: Array.isArray(pemeriksaanRanap) ? pemeriksaanRanap : [],
              tindakanRalan,
              tindakanRanap,
              obat,
              radiologi,
              laboratorium,
            });
          })
        );
        setDetailMap(newMap);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [patient?.no_rkm_medis]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 8, width: '95%', maxWidth: 1400, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#374151' }}>Riwayat Perawatan</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>×</span> Tutup
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Memuat...</div>}
          {error && <div style={{ color: '#dc2626', padding: 12 }}>{error}</div>}

          {!loading && !error && bio && (
            <>
              <h4 style={sectionTitleStyle}>Data Riwayat Perawatan Pasien</h4>
              <table style={tableStyle}>
                <tbody>
                  <Row label="No.RM">{bio.no_rkm_medis}</Row>
                  <Row label="Nama Pasien">{bio.nm_pasien}</Row>
                  <Row label="Alamat">{bio.alamat}</Row>
                  <Row label="Umur">{bio.umur} ({bio.jk === 'L' ? 'Laki-Laki' : 'Perempuan'})</Row>
                  <Row label="Tanggal Lahir">{bio.tgl_lahir}</Row>
                  <Row label="Ibu Kandung">{bio.nm_ibu}</Row>
                  <Row label="Golongan Darah">{bio.gol_darah}</Row>
                  <Row label="Status Nikah">{bio.stts_nikah}</Row>
                  <Row label="Agama">{bio.agama}</Row>
                  <Row label="Pendidikan Terakhir">{bio.pnd}</Row>
                  <Row label="Pertama Daftar">{bio.tgl_daftar}</Row>
                </tbody>
              </table>

              <h4 style={sectionTitleStyle}>Data Riwayat</h4>
              {riwayat.length === 0 ? (
                <div style={{ padding: 20, color: '#9ca3af', textAlign: 'center' }}>Belum ada riwayat perawatan</div>
              ) : (
                riwayat.map((item: any, idx: number) => {
                  const detail = detailMap.get(item.no_rawat) || {};
                  const triasePrimer = renderTriasePrimer(detail.triasePrimer);
                  const triaseSekunder = renderTriaseSekunder(detail.triaseSekunder);
                  const awalMedisIGD = renderAwalMedisIGD(detail.asuhanMedisIGD);
                  const pemeriksaanRalan = renderPemeriksaanTable(detail.pemeriksaanRalan);
                  const pemeriksaanRanap = renderPemeriksaanTable(detail.pemeriksaanRanap);
                  const tindakanRalan = renderTindakan(detail.tindakanRalan);
                  const tindakanRanap = renderTindakan(detail.tindakanRanap);
                  const obat = renderObat(detail.obat, item.status_lanjut);
                  const radiologi = renderRadiologi(detail.radiologi);
                  const lab = renderLaboratorium(detail.laboratorium);

                  return (
                    <table key={idx} style={tableStyle}>
                      <tbody>
                        <Row label="No.Rawat">{item.no_rawat}</Row>
                        <Row label="No.Registrasi">{item.no_reg}</Row>
                        <Row label="Tanggal Registrasi">{item.tgl_registrasi}</Row>
                        <Row label="Unit/Poliklinik">{item.nm_poli}</Row>
                        <Row label="Dokter">{item.nm_dokter}</Row>
                        <Row label="Penjamin">{item.png_jawab}</Row>
                        <Row label="Status">{item.status_lanjut}</Row>

                        {item.diagnosa_pasien?.length > 0 && (
                          <Row label="Diagnosa/Penyakit/ICD 10">
                            <IcdTable
                              headers={['Kode', 'Nama Penyakit', 'Prioritas']}
                              rows={item.diagnosa_pasien.map((d: any) => [d.kd_penyakit, d.nm_penyakit, d.prioritas])}
                            />
                          </Row>
                        )}

                        {item.prosedur_pasien?.length > 0 && (
                          <Row label="Prosedur Tindakan/ICD 9">
                            <IcdTable
                              headers={['Kode', 'Nama Prosedur', 'Prioritas']}
                              rows={item.prosedur_pasien.map((p: any) => [p.kode, p.deskripsi_panjang, p.prioritas])}
                            />
                          </Row>
                        )}

                        {triasePrimer && <Row label="Triase Gawat Darurat">{triasePrimer}</Row>}
                        {triaseSekunder && <Row label="Triase Gawat Darurat">{triaseSekunder}</Row>}

                        {awalMedisIGD && <Row label="Pengkajian Awal Medis IGD">{awalMedisIGD}</Row>}

                        {pemeriksaanRalan && <Row label="Pemeriksaan Rawat Jalan">{pemeriksaanRalan}</Row>}
                        {pemeriksaanRanap && <Row label="Pemeriksaan Rawat Inap">{pemeriksaanRanap}</Row>}

                        {tindakanRalan && <Row label="Tindakan Rawat Jalan">{tindakanRalan}</Row>}
                        {tindakanRanap && <Row label="Tindakan Rawat Inap">{tindakanRanap}</Row>}
                        {obat && <Row label="Pemberian Obat">{obat}</Row>}
                        {radiologi && <Row label="Radiologi">{radiologi}</Row>}
                        {lab && <Row label="Laboratorium">{lab}</Row>}
                      </tbody>
                    </table>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
