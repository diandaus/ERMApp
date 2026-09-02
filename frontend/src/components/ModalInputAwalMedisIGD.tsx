import React from 'react';
import Swal from 'sweetalert2';
import { ModalCariDokter } from './ModalCariDokter';

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

interface ModalInputAwalMedisIGDProps {
  isOpen: boolean;
  onClose: () => void;
  patient: any;
  onSuccess?: () => void;
  user?: AppUser;
}

// Enum PERSIS kolom penilaian_medis_igd (DESCRIBE, dicek langsung ke DB —
// bukan tebakan) & pilihan ComboBox di RMPenilaianAwalMedisIGD.java.
const ANAMNESIS_OPTIONS = ['Autoanamnesis', 'Alloanamnesis'];
const KEADAAN_OPTIONS = ['Sehat', 'Sakit Ringan', 'Sakit Sedang', 'Sakit Berat'];
const KESADARAN_OPTIONS = ['Compos Mentis', 'Apatis', 'Somnolen', 'Sopor', 'Koma'];
const FISIK_OPTIONS = ['Normal', 'Abnormal', 'Tidak Diperiksa'];

const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTimeStr = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400 };
const inputStyle: React.CSSProperties = { width: '100%', height: 30, padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' };
const headerInputStyle: React.CSSProperties = { padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', background: '#fff', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', resize: 'vertical', minHeight: 64, fontFamily: 'inherit' };

// Fokus kolom = border + ring biru tosca (#1AB1E5), konsisten dgn tema
// PemeriksaanIGD.tsx/ModalInputTriase.tsx.
const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#1AB1E5';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26,177,229,0.15)';
};
const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow = 'none';
};

const StepperIcon: React.FC = () => (
  <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#1AB1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 13, color: '#111827', paddingBottom: 8, borderBottom: '1px solid #e5e7eb' }}>{children}</div>
);

// ModalInputAwalMedisIGD.tsx — form input "Pengkajian Awal Medis IGD",
// dibuka dari tab "Awal Medis" di PemeriksaanIGD.tsx (tombol "+ Input
// Awal Medis"). Gaya SAMA persis dgn ModalInputTriase.tsx — panel
// full-height slide-in dari kanan, header info pasien identik (no_rawat/
// no_rkm_medis/nm_pasien/umur + Tanggal & Jam di header).
//
// Field & alur PERSIS RMPenilaianAwalMedisIGD.java (SIMRS Khanza Desktop,
// src/rekammedis/RMPenilaianAwalMedisIGD.java) — layout diverifikasi
// langsung dari setBounds() tiap komponen (bukan tebakan) supaya urutan
// baris/kolom sama persis referensi cetak (utils/awalMedisIgdDisplay.tsx):
// I. RIWAYAT KESEHATAN (Keluhan Utama|RPS, RPK|RPD, RPO|Alergi),
// II. PEMERIKSAAN FISIK (Keadaan/Kesadaran/GCS/TB/BB, TD/Nadi/RR/Suhu/
// SpO2, grid Kepala-Thoraks/Mata-Abdomen/Gigi&Mulut-Genital&Anus/Leher-
// Ekstremitas + Ket.Fisik di kanan), III. STATUS LOKALIS (gambar diagram
// tubuh statis + Keterangan bebas — TIDAK interaktif spt PanelWall Java yg
// bisa diklik per titik, disederhanakan jadi catatan teks saja),
// IV. PEMERIKSAAN PENUNJANG (EKG/Radiologi/Laborat), V. DIAGNOSIS/ASESMEN,
// VI. TATALAKSANA. Validasi wajib PERSIS BtnSimpanActionPerformed (urutan:
// Dokter, Keluhan Utama, RPS, RPK, RPD, RPO — sisanya opsional krn
// dropdown selalu punya default & field lain tidak dicek Java). Simpan ->
// POST /api/asuhan-medis-igd/simpan (INSERT SAJA, no_rawat PRIMARY KEY —
// padanan BtnSimpan/simpan() Java, BUKAN BtnEdit/ganti() krn belum ada
// alur koreksi data tersimpan).
export const ModalInputAwalMedisIGD: React.FC<ModalInputAwalMedisIGDProps> = ({ isOpen, onClose, patient, onSuccess, user }) => {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  const [tglAsuhan, setTglAsuhan] = React.useState(() => localDateStr());
  const [jamAsuhan, setJamAsuhan] = React.useState(() => localTimeStr());

  const [dokterKode, setDokterKode] = React.useState('');
  const [dokterNama, setDokterNama] = React.useState('');
  const [showCariDokter, setShowCariDokter] = React.useState(false);

  const [anamnesis, setAnamnesis] = React.useState(ANAMNESIS_OPTIONS[0]);
  const [hubungan, setHubungan] = React.useState('');

  const [keluhanUtama, setKeluhanUtama] = React.useState('');
  const [rps, setRps] = React.useState('');
  const [rpk, setRpk] = React.useState('');
  const [rpd, setRpd] = React.useState('');
  const [rpo, setRpo] = React.useState('');
  const [alergi, setAlergi] = React.useState('');

  const [keadaan, setKeadaan] = React.useState(KEADAAN_OPTIONS[0]);
  const [kesadaran, setKesadaran] = React.useState(KESADARAN_OPTIONS[0]);
  const [gcs, setGcs] = React.useState('');
  const [tb, setTb] = React.useState('');
  const [bb, setBb] = React.useState('');
  const [td, setTd] = React.useState('');
  const [nadi, setNadi] = React.useState('');
  const [rr, setRr] = React.useState('');
  const [suhu, setSuhu] = React.useState('');
  const [spo, setSpo] = React.useState('');

  const [kepala, setKepala] = React.useState(FISIK_OPTIONS[0]);
  const [mata, setMata] = React.useState(FISIK_OPTIONS[0]);
  const [gigi, setGigi] = React.useState(FISIK_OPTIONS[0]);
  const [leher, setLeher] = React.useState(FISIK_OPTIONS[0]);
  const [thoraks, setThoraks] = React.useState(FISIK_OPTIONS[0]);
  const [abdomen, setAbdomen] = React.useState(FISIK_OPTIONS[0]);
  const [genital, setGenital] = React.useState(FISIK_OPTIONS[0]);
  const [ekstremitas, setEkstremitas] = React.useState(FISIK_OPTIONS[0]);
  const [ketFisik, setKetFisik] = React.useState('');

  const [ketLokalis, setKetLokalis] = React.useState('');

  const [ekg, setEkg] = React.useState('');
  const [rad, setRad] = React.useState('');
  const [lab, setLab] = React.useState('');
  const [diagnosis, setDiagnosis] = React.useState('');
  const [tata, setTata] = React.useState('');

  const [saving, setSaving] = React.useState(false);

  // Dokter default = user yang login (konvensi username akun = kd_dokter) —
  // PERSIS isCek() di Java: cek dulu ke tabel dokter (kd_dokter=?), BUKAN
  // asal percaya user.full_name, krn user yg login belum tentu dokter
  // (mis. perawat/admin) — kalau kodenya tidak ketemu di tabel dokter,
  // dibiarkan kosong supaya wajib dicari manual lewat ModalCariDokter.
  React.useEffect(() => {
    if (!isOpen || !user?.username) return;
    (async () => {
      const res = await fetch(`/api/dokter?search=${encodeURIComponent(user.username)}`);
      if (!res.ok) return;
      const list: { kd_dokter: string; nm_dokter: string }[] = await res.json();
      const match = list.find((d) => d.kd_dokter === user.username);
      if (match) {
        setDokterKode(match.kd_dokter);
        setDokterNama(match.nm_dokter);
      }
    })();
  }, [isOpen, user]);

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Validasi urutan sama dgn BtnSimpanActionPerformed (RMPenilaianAwalMedisIGD.java).
  const validationError = (): string | null => {
    if (!dokterKode) return 'Dokter wajib dipilih';
    if (!keluhanUtama.trim()) return 'Keluhan Utama wajib diisi';
    if (!rps.trim()) return 'Riwayat Penyakit Sekarang wajib diisi';
    if (!rpk.trim()) return 'Riwayat Penyakit Keluarga wajib diisi';
    if (!rpd.trim()) return 'Riwayat Penyakit Dahulu wajib diisi';
    if (!rpo.trim()) return 'Riwayat Penggunaan Obat wajib diisi';
    return null;
  };

  const handleSimpan = async () => {
    const err = validationError();
    if (err) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: err, confirmButtonColor: '#1AB1E5' });
      return;
    }

    const payload = {
      no_rawat: patient?.no_rawat,
      tanggal: `${tglAsuhan} ${jamAsuhan}:00`,
      kd_dokter: dokterKode,
      anamnesis,
      hubungan,
      keluhan_utama: keluhanUtama,
      rps,
      rpd,
      rpk,
      rpo,
      alergi,
      keadaan,
      gcs,
      kesadaran,
      td,
      nadi,
      rr,
      suhu,
      spo,
      bb,
      tb,
      kepala,
      mata,
      gigi,
      leher,
      thoraks,
      abdomen,
      genital,
      ekstremitas,
      ket_fisik: ketFisik,
      ket_lokalis: ketLokalis,
      ekg,
      rad,
      lab,
      diagnosis,
      tata,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/asuhan-medis-igd/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan awal medis');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Awal medis berhasil disimpan', confirmButtonColor: '#1AB1E5' });
      onSuccess?.();
      onClose();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan saat menyimpan', confirmButtonColor: '#1AB1E5' });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
      onClick={onClose}
    >
      {/* Panel — anchor kanan, full height, slide dari kanan ke kiri, PERSIS ModalInputTriase.tsx */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '50vw', maxWidth: '90vw',
          background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — identik ModalInputTriase.tsx */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#000000', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            {[patient?.no_rawat, patient?.no_rkm_medis, patient?.nm_pasien, patient?.umur]
              .filter(Boolean)
              .map((v, i, arr) => (
                <React.Fragment key={i}>
                  <span>{v}</span>
                  {i < arr.length - 1 && <span>|</span>}
                </React.Fragment>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <input type="date" value={tglAsuhan} onChange={(e) => setTglAsuhan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={headerInputStyle} />
            <input type="time" value={jamAsuhan} onChange={(e) => setJamAsuhan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={headerInputStyle} />
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Dokter + Anamnesis + Hubungan */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1.4 }}>
              <label style={labelStyle}>Dokter</label>
              <div style={{ display: 'flex', gap: 2, position: 'relative' }}>
                <input type="text" value={dokterNama} readOnly placeholder="Cari dokter..." style={{ ...inputStyle, flex: 1, background: '#f9fafb' }} />
                <button
                  type="button" onClick={() => setShowCariDokter(true)} title="Cari dokter"
                  style={{ padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Anamnesis</label>
              <div style={{ position: 'relative' }}>
                <select value={anamnesis} onChange={(e) => setAnamnesis(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                  {ANAMNESIS_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <StepperIcon />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Hubungan</label>
              <input type="text" value={hubungan} onChange={(e) => setHubungan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={30} placeholder="Hubungan dgn pasien..." style={inputStyle} />
            </div>
          </div>

          <SectionTitle>I. RIWAYAT KESEHATAN</SectionTitle>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Keluhan Utama</label>
              <textarea value={keluhanUtama} onChange={(e) => setKeluhanUtama(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Riwayat Penyakit Sekarang</label>
              <textarea value={rps} onChange={(e) => setRps(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Riwayat Penyakit Keluarga</label>
              <textarea value={rpk} onChange={(e) => setRpk(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={1000} style={textareaStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Riwayat Penyakit Dahulu</label>
              <textarea value={rpd} onChange={(e) => setRpd(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={1000} style={textareaStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Riwayat Penggunaan Obat</label>
              <textarea value={rpo} onChange={(e) => setRpo(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={1000} style={textareaStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Riwayat Alergi</label>
              <input type="text" value={alergi} onChange={(e) => setAlergi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={100} style={inputStyle} />
            </div>
          </div>

          <SectionTitle>II. PEMERIKSAAN FISIK</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>Keadaan Umum</label>
              <div style={{ position: 'relative' }}>
                <select value={keadaan} onChange={(e) => setKeadaan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                  {KEADAAN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <StepperIcon />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Kesadaran</label>
              <div style={{ position: 'relative' }}>
                <select value={kesadaran} onChange={(e) => setKesadaran(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                  {KESADARAN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <StepperIcon />
              </div>
            </div>
            <div>
              <label style={labelStyle}>GCS(E,V,M)</label>
              <input type="text" value={gcs} onChange={(e) => setGcs(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={10} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>TB (cm)</label>
              <input type="text" value={tb} onChange={(e) => setTb(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>BB (Kg)</label>
              <input type="text" value={bb} onChange={(e) => setBb(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>TD (mmHg)</label>
              <input type="text" value={td} onChange={(e) => setTd(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={8} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nadi (x/menit)</label>
              <input type="text" value={nadi} onChange={(e) => setNadi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>RR (x/menit)</label>
              <input type="text" value={rr} onChange={(e) => setRr(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Suhu (°C)</label>
              <input type="text" value={suhu} onChange={(e) => setSuhu(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SpO2 (%)</label>
              <input type="text" value={spo} onChange={(e) => setSpo(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
          </div>

          {/* Grid Kepala/Thoraks/Mata/Abdomen/Gigi&Mulut/Genital&Anus/Leher/Ekstremitas
              (kiri, 2 kolom x 4 baris) + Ket.Fisik (kanan, textarea tinggi
              menyamai grid) — PERSIS tata letak setBounds() Java / referensi
              cetak Khanza Desktop (grid + kolom lebar di kanan, hemat ruang
              vertikal — dikonfirmasi user via screenshot PDF Khanza asli). */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
              <div>
                <label style={labelStyle}>Kepala</label>
                <div style={{ position: 'relative' }}>
                  <select value={kepala} onChange={(e) => setKepala(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Thoraks</label>
                <div style={{ position: 'relative' }}>
                  <select value={thoraks} onChange={(e) => setThoraks(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Mata</label>
                <div style={{ position: 'relative' }}>
                  <select value={mata} onChange={(e) => setMata(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Abdomen</label>
                <div style={{ position: 'relative' }}>
                  <select value={abdomen} onChange={(e) => setAbdomen(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Gigi & Mulut</label>
                <div style={{ position: 'relative' }}>
                  <select value={gigi} onChange={(e) => setGigi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Genital & Anus</label>
                <div style={{ position: 'relative' }}>
                  <select value={genital} onChange={(e) => setGenital(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Leher</label>
                <div style={{ position: 'relative' }}>
                  <select value={leher} onChange={(e) => setLeher(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Ekstremitas</label>
                <div style={{ position: 'relative' }}>
                  <select value={ekstremitas} onChange={(e) => setEkstremitas(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={selectStyle}>
                    {FISIK_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ket. Pemeriksaan Fisik</label>
              <textarea value={ketFisik} onChange={(e) => setKetFisik(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5000} style={{ ...textareaStyle, minHeight: 176, height: '100%' }} />
            </div>
          </div>

          <SectionTitle>III. STATUS LOKALIS</SectionTitle>
          <div style={{ textAlign: 'center' }}>
            <img src="/asuhan-medis-igd/semua.png" alt="Gambar Lokalis" style={{ width: '100%', maxWidth: 500, height: 'auto' }} />
          </div>
          <div>
            <label style={labelStyle}>Keterangan</label>
            <textarea value={ketLokalis} onChange={(e) => setKetLokalis(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={3000} style={textareaStyle} />
          </div>

          <SectionTitle>IV. PEMERIKSAAN PENUNJANG</SectionTitle>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>EKG</label>
              <textarea value={ekg} onChange={(e) => setEkg(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={3000} style={textareaStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Radiologi</label>
              <textarea value={rad} onChange={(e) => setRad(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={textareaStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Laborat</label>
              <textarea value={lab} onChange={(e) => setLab(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} style={textareaStyle} />
            </div>
          </div>

          <SectionTitle>V. DIAGNOSIS/ASESMEN</SectionTitle>
          <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={500} style={textareaStyle} />

          <SectionTitle>VI. TATALAKSANA</SectionTitle>
          <textarea value={tata} onChange={(e) => setTata(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5000} style={{ ...textareaStyle, minHeight: 120 }} />
        </div>

        {/* Footer — sticky */}
        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={saving}
            style={{ width: '100%', padding: '12px 16px', borderRadius: 4, border: 'none', background: saving ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
            onMouseOver={(e) => { if (!saving) e.currentTarget.style.background = '#0891B2'; }}
            onMouseOut={(e) => { if (!saving) e.currentTarget.style.background = '#1AB1E5'; }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Awal Medis'}
          </button>
        </div>
      </div>

      {/* stopPropagation — ModalCariDokter tidak pakai portal, jadi nested
          di dalam overlay panel ini; tanpa ini klik di backdrop-nya akan
          ikut bubble & memicu onClose panel Awal Medis juga. */}
      <div onClick={(e) => e.stopPropagation()}>
        <ModalCariDokter
          isOpen={showCariDokter}
          onClose={() => setShowCariDokter(false)}
          onSelect={(kode, nama) => {
            setDokterKode(kode);
            setDokterNama(nama);
          }}
        />
      </div>
    </div>
  );
};
