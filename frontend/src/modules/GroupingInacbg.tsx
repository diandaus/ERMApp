import React from 'react';

// GroupingInacbg.tsx — dibuka dari Casemix > List Klaim (klik No Rawat).
// BARU header (Data Pasien/Registrasi/Kunjungan, lihat
// backend/grouping_inacbg_handler.go) — bagian proses grouping (pilih
// diagnosa/prosedur, kirim ke aplikasi INA-CBG) menyusul, belum dibangun.
// Tab "Berkas Klaim" pakai BerkasKlaimGabungView (di bawah) — GABUNGAN dua
// sumber, sama-sama disimpan di folder fisik berkasrawat/pages/upload tapi
// beda cara dilacak (dikonfirmasi dari 2 sumber: file lokal
// SIMRS-Khanza/webapps DAN kode caller Java MnTampilkanBerkasActionPerformed
// yg dikirim user, pathFile="berkasrawat/pages/upload" sama persis):
//  1. Dokumen resmi hasil TTE (SEP_/Gruper_/Resume_/dst) — BUKAN tercatat
//     di tabel manapun, dicek langsung by nama file (getBerkasKlaimTte).
//  2. Berkas upload manual (KTP, foto, dll) — tercatat di
//     berkas_digital_perawatan (endpoint /api/berkas-rawat/list yg sudah
//     ada, dipakai jg UploadTab.tsx), padanan berkasrawat/pages/tampilpdf.php.
// Semua ditampilkan SATU LIST bertumpuk berurutan (bukan card+modal) —
// dokumen TTE resmi duluan, baru berkas upload manual.

type BerkasRawatItem = {
  no_rawat: string; kode: string; nama_berkas: string;
  lokasi_file: string; nama_file: string; ekstensi: string;
};
type BerkasTteItem = { label: string; url: string };
type BerkasGabungan = { key: string; label: string; url: string; ekstensi: string };

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];

const berkasRawatUrl = (lokasiFile: string) => encodeURI('/berkasrawat/' + lokasiFile);

const BerkasKlaimGabungView: React.FC<{ noRawat: string }> = ({ noRawat }) => {
  const [items, setItems] = React.useState<BerkasGabungan[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setItems(null);
    setError(null);
    Promise.all([
      fetch(`/api/casemix/berkas-klaim-tte/${encodeURIComponent(noRawat)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/api/berkas-rawat/list/${encodeURIComponent(noRawat)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([tte, upload]: [BerkasTteItem[], BerkasRawatItem[]]) => {
        const tteItems: BerkasGabungan[] = (Array.isArray(tte) ? tte : []).map((t) => ({
          key: `tte-${t.url}`, label: t.label, url: t.url, ekstensi: 'pdf',
        }));
        const uploadItems: BerkasGabungan[] = (Array.isArray(upload) ? upload : []).map((u) => ({
          key: `upload-${u.kode}-${u.lokasi_file}`, label: u.nama_berkas || u.nama_file,
          url: berkasRawatUrl(u.lokasi_file), ekstensi: u.ekstensi,
        }));
        setItems([...tteItems, ...uploadItems]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'));
  }, [noRawat]);

  const centerStyle: React.CSSProperties = { padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 };

  if (error) return <div style={{ ...centerStyle, color: '#dc2626' }}>{error}</div>;
  if (items === null) return <div style={centerStyle}>Memuat berkas...</div>;
  if (items.length === 0) {
    return <div style={centerStyle}>Belum ada berkas untuk No. Rawat: {noRawat}</div>;
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => {
        const isImage = IMAGE_EXT.includes(item.ekstensi);
        return (
          <div key={item.key}>
            {i > 0 && <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{item.label}</div>
            {isImage ? (
              <img src={item.url} alt={item.label} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #d1d5db', display: 'block' }} />
            ) : item.ekstensi === 'pdf' ? (
              <div style={{ border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
                <iframe src={item.url} title={item.label} style={{ width: '100%', height: 800, border: 'none', display: 'block' }} />
              </div>
            ) : (
              <div style={{ padding: 12, border: '1px dashed #d1d5db', borderRadius: 8, fontSize: 12.5, color: '#6b7280' }}>
                Berkas ini ({item.ekstensi || 'file'}) tidak bisa ditampilkan langsung —{' '}
                <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>unduh</a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

type GroupingHeader = {
  no_rawat: string; no_rm: string; nm_pasien: string; umur: string; jk: string; alamat: string;
  tgl_registrasi: string; tanggal_pulang: string; poliklinik: string; dpjp: string; status: string; jaminan: string;
  no_sep: string; no_kunjungan: string; no_kartu: string; tipe: string; cbg: string; petugas: string;
  dx_utama: string; pros_utama: string; cob: string;
  naik_kelas: string; ada_rawat_intensif: string; kelas_hak: string; cara_masuk: string; los: string;
  berat_lahir: string; adl_score: string; cara_pulang: string; jenis_tarif: string; pasien_tb: string;
};

const labelStyle: React.CSSProperties = { width: 100, flexShrink: 0, fontSize: 12, color: '#6b7280' };
const valueStyle: React.CSSProperties = { fontSize: 12, color: '#111827', fontWeight: 500 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 4, padding: '1px 0', lineHeight: 1.4 };

const HeaderField: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({ label, value, accent }) => (
  <div style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <span style={{ ...valueStyle, color: accent ? '#ea580c' : valueStyle.color, fontWeight: accent ? 700 : valueStyle.fontWeight }}>
      : {value || '-'}
    </span>
  </div>
);

// Badge ikon warna per kolom — biar tiap seksi (Pasien/Registrasi/Kunjungan)
// gampang dibedakan sekilas, bukan cuma judul teks polos.
const ColumnTitle: React.FC<{ icon: React.ReactNode; iconBg: string; iconColor: string; children: React.ReactNode }> = ({ icon, iconBg, iconColor, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <div style={{ width: 24, height: 24, borderRadius: 7, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div style={{ fontSize: 13, color: '#111827' }}>{children}</div>
  </div>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);
const IconCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path>
  </svg>
);
const IconClipboard = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1"></rect>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    <path d="M9 12h6"></path><path d="M9 16h6"></path>
  </svg>
);
const IconShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z"></path>
    <path d="m9 12 2 2 4-4"></path>
  </svg>
);

// GroupingFormView — padanan tampilan aplikasi E-Klaim (screenshot yg
// dikirim user) utk tab "Grouping". Field yg bisa diprefill dari data yg
// SUDAH ada (bridging_sep/reg_periksa/kamar_inap/dpjp_ranap, lihat
// backend/grouping_form_handler.go) langsung terisi; field yg belum ada
// sumber datanya di skema Khanza (ADL Score, Jenis Tarif/kelas RS, Pasien
// TB, breakdown tarif per kategori) dikosongkan/0 spy staf isi manual —
// SAMA PERSIS gaya form E-Klaim aslinya (form input, bukan laporan
// otomatis). Tombol Kirim sengaja nonaktif — kirim ke E-Klaim (webservice
// terenkripsi AES-256-CBC ke server terpisah) belum diimplementasikan.
type GroupingFormData = {
  tanggal_masuk: string; tanggal_pulang: string; jaminan: string; no_sep: string; tipe: string;
  no_peserta: string; cob: boolean; jenis_rawat: 'jalan' | 'inap'; naik_kelas: boolean; kelas_hak: string;
  tgl_masuk_jam: string; tgl_pulang_jam: string; umur: string; cara_masuk: string; los: number;
  berat_lahir: string; cara_pulang: string; dpjp: string;
};

const TARIF_KOLOM: { label: string }[][] = [
  [{ label: 'Prosedur Non Bedah' }, { label: 'Tenaga Ahli' }, { label: 'Radiologi' }, { label: 'Rehabilitasi' }, { label: 'Obat' }, { label: 'Alkes' }],
  [{ label: 'Prosedur Bedah' }, { label: 'Keperawatan' }, { label: 'Laboratorium' }, { label: 'Kamar / Akomodasi' }, { label: 'Obat Kronis' }, { label: 'BMHP' }],
  [{ label: 'Konsultasi' }, { label: 'Penunjang' }, { label: 'Pelayanan Darah' }, { label: 'Rawat Intensif' }, { label: 'Obat Kemoterapi' }, { label: 'Sewa Alat' }],
];

const gLabel: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontStyle: 'italic' };
const gInput: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none', width: '100%', boxSizing: 'border-box' };
const gRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' };

const GroupingFormView: React.FC<{ noRawat: string }> = ({ noRawat }) => {
  const [form, setForm] = React.useState<GroupingFormData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tarif, setTarif] = React.useState<Record<string, number>>({});
  const [setuju, setSetuju] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/casemix/grouping-form/${encodeURIComponent(noRawat)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal memuat data grouping');
        setForm(d);
        setTarif({});
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, [noRawat]);

  const totalTarif = Object.values(tarif).reduce((a, b) => a + (b || 0), 0);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Memuat...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 13 }}>{error}</div>;
  if (!form) return null;

  return (
    <div style={{ padding: 20 }}>
      {/* Semua field ringkasan (Jenis Rawat, Naik/Turun Kelas, Ada Rawat
          Intensif, Kelas Hak, Tanggal Rawat, Umur, Cara Masuk, LOS, Berat
          Lahir, ADL Score, Cara Pulang, Jenis Tarif, Pasien TB) sudah
          dipindah ke kolom "Info Klaim" di header halaman — form ini
          sekarang cuma isi breakdown tarif (satu-satunya bagian yg
          memang butuh diisi manual). */}

      {/* Tarif Rumah Sakit total */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
        <span style={{ fontSize: 12.5, color: '#6b7280' }}>Tarif Rumah Sakit : </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Rp {totalTarif.toLocaleString('id-ID')}</span>
      </div>

      {/* Breakdown tarif — 3 kolom, semua editable default 0 spt E-Klaim asli */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '4px 24px', marginBottom: 16 }}>
        {TARIF_KOLOM.map((kolom, ki) => (
          <div key={ki} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kolom.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...gLabel, width: 130, flexShrink: 0 }}>{item.label}</span>
                <input
                  type="number"
                  style={{ ...gInput, width: 110 }}
                  value={tarif[item.label] ?? 0}
                  onChange={(e) => setTarif((prev) => ({ ...prev, [item.label]: Number(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: '#374151', marginBottom: 16 }}>
        <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
        Menyatakan benar bahwa data tarif yang tersebut di atas adalah benar sesuai dengan kondisi yang sesungguhnya.
      </label>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          disabled
          title="Kirim ke E-Klaim belum diimplementasikan"
          style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#9ca3af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}
        >
          Kirim (Segera Hadir)
        </button>
      </div>
    </div>
  );
};

type Section = 'grouping' | 'berkas-klaim';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'berkas-klaim', label: 'Berkas Klaim' },
  { key: 'grouping', label: 'Grouping' },
];

type Props = { noRawat: string; onBack: () => void };

export const GroupingInacbgView: React.FC<Props> = ({ noRawat, onBack }) => {
  const [data, setData] = React.useState<GroupingHeader | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<Section>('berkas-klaim');

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/casemix/grouping-inacbg/${encodeURIComponent(noRawat)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal memuat data kunjungan');
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, [noRawat]);

  // Full-bleed: strip putih di atas (tombol × + 3 kolom header) nempel
  // langsung ke tepi layar (tanpa card/shadow/rounded), garis pemisah
  // tipis, lalu badan abu-abu mengisi sisa layar — persis mockup yang
  // diminta (bukan lagi kartu putih dgn padding di semua sisi).
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#eeeeee', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 24px' }}>
            <CloseBtn onClick={onBack} />
            <span style={{ color: '#6b7280', fontSize: 13 }}>Memuat...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 24px' }}>
            <CloseBtn onClick={onBack} />
            <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>
          </div>
        ) : data ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, padding: '10px 24px 12px', flexWrap: 'wrap' }}>
            <CloseBtn onClick={onBack} />
            <div style={{ minWidth: 240 }}>
              <ColumnTitle icon={<IconUser />} iconBg="#dbeafe" iconColor="#2563eb">Data Pasien</ColumnTitle>
              <HeaderField label="No.Rawat" value={data.no_rawat} />
              <HeaderField label="No.RM" value={data.no_rm} />
              <HeaderField label="Nama Pasien" value={data.nm_pasien} />
              <HeaderField label="Umur" value={data.umur} />
              <HeaderField label="Jenis Kelamin" value={data.jk} />
              <HeaderField label="Alamat Pasien" value={data.alamat} />
            </div>
            <div style={{ minWidth: 240 }}>
              <ColumnTitle icon={<IconCalendar />} iconBg="#dcfce7" iconColor="#16a34a">Data Registrasi</ColumnTitle>
              <HeaderField label="Tgl.Registrasi" value={data.tgl_registrasi} />
              <HeaderField label="Tgl.Pulang" value={data.tanggal_pulang} />
              <HeaderField label="Poliklinik" value={data.poliklinik} />
              <HeaderField label="DPJP" value={data.dpjp} />
              <HeaderField label="Status" value={data.status} />
              <HeaderField label="Jaminan" value={data.jaminan} />
            </div>
            <div style={{ minWidth: 260 }}>
              <ColumnTitle icon={<IconClipboard />} iconBg="#fef3c7" iconColor="#d97706">Data Kunjungan</ColumnTitle>
              <HeaderField label="No SEP" value={data.no_sep} />
              <HeaderField label="No. Kunjungan" value={data.no_kunjungan} />
              <HeaderField label="No. Kartu" value={data.no_kartu} />
              <HeaderField label="Tipe" value={data.tipe} />
              <HeaderField label="CBG" value={data.cbg} />
              <HeaderField label="Petugas" value={data.petugas} />
              <HeaderField label="Dx. Utama" value={data.dx_utama} accent />
              <HeaderField label="Pros. Utama" value={data.pros_utama} accent />
            </div>
            <div style={{ minWidth: 200 }}>
              <ColumnTitle icon={<IconShield />} iconBg="#ede9fe" iconColor="#7c3aed">Info Klaim</ColumnTitle>
              <HeaderField label="COB" value={data.cob} />
              <HeaderField label="Naik Kelas" value={data.naik_kelas} />
              <HeaderField label="Rawat Intensif" value={data.ada_rawat_intensif} />
              <HeaderField label="Kelas Hak" value={data.kelas_hak} />
              <HeaderField label="Cara Masuk" value={data.cara_masuk} />
              <HeaderField label="LOS" value={data.los} />
              <HeaderField label="Berat Lahir" value={data.berat_lahir} />
              <HeaderField label="ADL Score" value={data.adl_score} />
              <HeaderField label="Cara Pulang" value={data.cara_pulang} />
              <HeaderField label="Jenis Tarif" value={data.jenis_tarif} />
              <HeaderField label="Pasien TB" value={data.pasien_tb} />
            </div>
          </div>
        ) : null}
      </div>

      {data && (
        <div style={{ display: 'flex', gap: 0, padding: '12px 24px', flexShrink: 0 }}>
          {SECTIONS.map((s, i) => {
            const active = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                style={{
                  padding: '7px 16px', borderRadius: 0, border: '1px solid #d1d5db',
                  background: active ? '#2563eb' : '#ffffff', color: active ? '#ffffff' : '#374151',
                  borderColor: active ? '#2563eb' : '#d1d5db',
                  fontSize: 12.5, fontWeight: active ? 600 : 400, cursor: 'pointer',
                  marginLeft: i === 0 ? 0 : -1,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {section === 'grouping' ? (
          // Khusus form Grouping — dibungkus card putih (bukan langsung di
          // atas BG abu-abu spt Berkas Klaim), formnya lebih enak dibaca
          // dgn batas jelas krn banyak input berdempetan.
          <div style={{ padding: 20 }}>
            <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <GroupingFormView noRawat={noRawat} />
            </div>
          </div>
        ) : (
          <BerkasKlaimGabungView noRawat={noRawat} />
        )}
      </div>
    </div>
  );
};

const CloseBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Tutup"
    style={{
      width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
      background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#6b7280', cursor: 'pointer', padding: 0, flexShrink: 0,
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"></path>
      <path d="m6 6 12 12"></path>
    </svg>
  </button>
);
