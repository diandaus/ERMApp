import React from 'react';
import Swal from 'sweetalert2';
import { ModalCariPegawai } from './ModalCariPegawai';

type AppUser = {
  username: string;
  full_name: string;
  role: string;
};

// SoapPrefill — dikirim dari PemeriksaanIGD.tsx saat user klik Edit/Copy
// pada baris SOAP tersimpan (lihat SoapCpptDisplay/soapCpptIgdDisplay.tsx).
// mode:'edit' → PUT (update record yg sama, Tanggal/Jam dikunci krn jadi
// bagian primary key). mode:'copy' → tetap POST (entri baru), cuma isi
// form yg di-prefill. `signal` (Date.now()) unik per-klik supaya klik
// Edit/Copy berulang pada item yg SAMA tetap memicu efek prefill.
type SoapPrefill = {
  mode: 'edit' | 'copy';
  signal: number;
  item: {
    tgl_perawatan: string; // "DD/MM/YYYY" (lihat getPemeriksaanRalan di backend)
    jam_rawat: string; // "HH:MM:SS"
    suhu_tubuh: string; tensi: string; nadi: string; respirasi: string; tinggi: string; berat: string;
    spo2: string; gcs: string; kesadaran: string;
    keluhan: string; pemeriksaan: string; alergi: string; lingkar_perut: string;
    rtl: string; penilaian: string; instruksi: string; evaluasi: string;
    nip: string; nama: string;
  };
};

interface SoapCpptFormIGDProps {
  patient: any;
  user?: AppUser;
  prefill?: SoapPrefill | null;
  // lanjutResep=true saat user klik "Lanjutkan Input Resep" di dialog sukses.
  onSaved?: (lanjutResep?: boolean) => void;
}

// Enum PERSIS kolom pemeriksaan_ralan.kesadaran (DESCRIBE, dicek langsung
// ke DB) — tabel yg sama dipakai SOAP Poli (Pemeriksaan.tsx), IGD reuse
// endpoint yg sama (lihat komentar SoapCpptDisplay di PemeriksaanIGD.tsx).
const KESADARAN_OPTIONS = ['Compos Mentis', 'Apatis', 'Somnolence', 'Sopor', 'Coma', 'Alert', 'Confusion', 'Voice', 'Pain', 'Unresponsive', 'Delirium', 'Meninggal'];

const localDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTimeStr = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Konversi tgl_perawatan "DD/MM/YYYY" (format tampilan, dari
// getPemeriksaanRalan backend) ke "YYYY-MM-DD" (format <input type="date">).
const ddmmyyyyToIso = (s: string): string => {
  const [d, m, y] = (s || '').split('/');
  return d && m && y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : localDateStr();
};
// "HH:MM:SS" → "HH:MM" (format <input type="time">).
const hhmmssToHhmm = (s: string): string => ((s || '').slice(0, 5)) || localTimeStr();

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400 };
const inputStyle: React.CSSProperties = { width: '100%', height: 30, padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' };
const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', resize: 'vertical', minHeight: 64, fontFamily: 'inherit' };

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

// SoapCpptFormIGD.tsx — form input SOAP/CPPT LANGSUNG tertanam di tab
// "SOAP/CPPT" (PemeriksaanIGD.tsx), BUKAN modal/panel slide-in (beda dari
// Triase/Awal Medis) — per keputusan user. Reuse endpoint generik POST
// /api/pemeriksaan/soap (tabel pemeriksaan_ralan) yg SAMA dipakai tab SOAP
// Pemeriksaan.tsx (Poli) — kunjungan IGD sudah diperlakukan flavor Ralan
// di seluruh backend, jadi TIDAK ADA endpoint/tabel baru. Validasi wajib
// (keluhan/pemeriksaan/penilaian/nip) PERSIS binding:"required" di handler
// POST /api/pemeriksaan/soap (backend/main.go).
export const SoapCpptFormIGD: React.FC<SoapCpptFormIGDProps> = ({ patient, user, prefill, onSaved }) => {
  const [tglPerawatan, setTglPerawatan] = React.useState(() => localDateStr());
  const [jamRawat, setJamRawat] = React.useState(() => localTimeStr());
  // true saat form diisi dari klik "Edit" (bukan "Copy") — Simpan jadi PUT,
  // Tanggal/Jam dikunci (readOnly) krn itu bagian primary key record.
  const [isEditMode, setIsEditMode] = React.useState(false);

  const [petugasNip, setPetugasNip] = React.useState('');
  const [petugasNama, setPetugasNama] = React.useState('');
  const [showCariPetugas, setShowCariPetugas] = React.useState(false);

  const [keluhan, setKeluhan] = React.useState('');
  const [pemeriksaan, setPemeriksaan] = React.useState('');

  const [suhuTubuh, setSuhuTubuh] = React.useState('');
  const [tensi, setTensi] = React.useState('');
  const [nadi, setNadi] = React.useState('');
  const [respirasi, setRespirasi] = React.useState('');
  const [tinggi, setTinggi] = React.useState('');
  const [berat, setBerat] = React.useState('');
  const [spo2, setSpo2] = React.useState('');
  const [gcs, setGcs] = React.useState('');
  const [kesadaran, setKesadaran] = React.useState(KESADARAN_OPTIONS[0]);
  const [alergi, setAlergi] = React.useState('');
  const [lingkarPerut, setLingkarPerut] = React.useState('');

  const [penilaian, setPenilaian] = React.useState('');
  const [rtl, setRtl] = React.useState('');
  const [instruksi, setInstruksi] = React.useState('');
  const [evaluasi, setEvaluasi] = React.useState('');

  const [saving, setSaving] = React.useState(false);

  // Petugas default = user yang login, persis pola Dokter/Petugas IGD di
  // ModalInputTriase.tsx — tetap bisa dikoreksi manual lewat ModalCariPegawai.
  React.useEffect(() => {
    if (user?.username) {
      setPetugasNip(user.username);
      setPetugasNama(user.full_name || '');
    }
  }, [user]);

  const resetForm = () => {
    setTglPerawatan(localDateStr());
    setJamRawat(localTimeStr());
    setKeluhan(''); setPemeriksaan('');
    setSuhuTubuh(''); setTensi(''); setNadi(''); setRespirasi(''); setTinggi(''); setBerat('');
    setSpo2(''); setGcs(''); setKesadaran(KESADARAN_OPTIONS[0]); setAlergi(''); setLingkarPerut('');
    setPenilaian(''); setRtl(''); setInstruksi(''); setEvaluasi('');
    setIsEditMode(false);
  };

  // Konsumsi prefill dari SoapCpptDisplay (klik Edit/Copy) — signal
  // dibandingkan (bukan object ref) supaya klik berulang pd item yg SAMA
  // tetap memicu prefill ulang (mis. setelah user sempat mengubah field).
  const prevPrefillSignalRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    if (!prefill || prefill.signal === prevPrefillSignalRef.current) return;
    prevPrefillSignalRef.current = prefill.signal;
    const item = prefill.item;
    setTglPerawatan(ddmmyyyyToIso(item.tgl_perawatan));
    setJamRawat(hhmmssToHhmm(item.jam_rawat));
    setPetugasNip(item.nip || '');
    setPetugasNama(item.nama || '');
    setSuhuTubuh(item.suhu_tubuh || '');
    setTensi(item.tensi || '');
    setNadi(item.nadi || '');
    setRespirasi(item.respirasi || '');
    setTinggi(item.tinggi || '');
    setBerat(item.berat || '');
    setSpo2(item.spo2 || '');
    setGcs(item.gcs || '');
    setKesadaran(item.kesadaran || KESADARAN_OPTIONS[0]);
    setAlergi(item.alergi || '');
    setLingkarPerut(item.lingkar_perut || '');
    setKeluhan(item.keluhan || '');
    setPemeriksaan(item.pemeriksaan || '');
    setPenilaian(item.penilaian || '');
    setRtl(item.rtl || '');
    setInstruksi(item.instruksi || '');
    setEvaluasi(item.evaluasi || '');
    setIsEditMode(prefill.mode === 'edit');
  }, [prefill]);

  // Validasi PERSIS binding:"required" di handler POST /api/pemeriksaan/soap.
  const validationError = (): string | null => {
    if (!petugasNip) return 'Dokter/Petugas wajib dipilih';
    if (!keluhan.trim()) return 'Subjektif (Keluhan) wajib diisi';
    if (!pemeriksaan.trim()) return 'Objektif (Pemeriksaan) wajib diisi';
    if (!penilaian.trim()) return 'Asesmen (Penilaian) wajib diisi';
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
      tgl_perawatan: tglPerawatan,
      jam_rawat: `${jamRawat}:00`,
      suhu_tubuh: suhuTubuh,
      tensi,
      nadi,
      respirasi,
      tinggi,
      berat,
      spo2,
      gcs,
      kesadaran,
      keluhan,
      pemeriksaan,
      alergi,
      lingkar_perut: lingkarPerut,
      rtl,
      penilaian,
      instruksi,
      evaluasi,
      nip: petugasNip,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/pemeriksaan/soap', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isEditMode ? 'Gagal mengupdate SOAP/CPPT' : 'Gagal menyimpan SOAP/CPPT'));

      // Sama spt tab SOAP Pemeriksaan.tsx (Rawat Jalan): tawarkan lanjut ke
      // Input Resep alih-alih toast biasa, supaya alurnya konsisten.
      const result = await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: isEditMode ? 'SOAP/CPPT berhasil diupdate' : 'SOAP/CPPT berhasil disimpan',
        showCancelButton: true,
        showConfirmButton: true,
        confirmButtonText: 'Lanjutkan Input Resep',
        cancelButtonText: 'Tidak, tutup',
        confirmButtonColor: '#1AB1E5',
        cancelButtonColor: '#6b7280',
        reverseButtons: false,
        didOpen: (popup) => {
          const actions = popup.querySelector('.swal2-actions') as HTMLElement | null;
          if (actions) {
            actions.style.flexDirection = 'column';
            actions.style.width = '100%';
            actions.style.gap = '8px';
          }
          popup.querySelectorAll<HTMLElement>('.swal2-actions button').forEach((btn) => {
            btn.style.width = '80%';
            btn.style.margin = '0';
            btn.style.borderRadius = '0';
          });
        },
      });
      resetForm();
      onSaved?.(result.isConfirmed);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e instanceof Error ? e.message : 'Terjadi kesalahan saat menyimpan', confirmButtonColor: '#1AB1E5' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {isEditMode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', background: '#e0f2fe', border: '1px solid #1AB1E5', color: '#0369a1', fontSize: 12.5, fontWeight: 500 }}>
          <span>Mode Edit — mengubah data SOAP/CPPT tanggal {tglPerawatan} {jamRawat}. Tanggal/Jam dikunci karena jadi kunci data.</span>
          <button
            type="button"
            onClick={resetForm}
            style={{ padding: '4px 10px', borderRadius: 0, border: '1px solid #0369a1', background: '#fff', color: '#0369a1', cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}
          >
            Batal Edit
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1.4 }}>
          <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Dokter/Petugas :</label>
          <div style={{ display: 'flex', gap: 2, position: 'relative', flex: 1 }}>
            <input type="text" value={petugasNama} readOnly placeholder="Cari dokter/petugas..." style={{ ...inputStyle, flex: 1, background: '#f9fafb' }} />
            <button
              type="button" onClick={() => setShowCariPetugas(true)} title="Cari petugas"
              style={{ padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Tanggal :</label>
          <input type="date" value={tglPerawatan} onChange={(e) => setTglPerawatan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} readOnly={isEditMode} style={{ ...inputStyle, width: 160, background: isEditMode ? '#f3f4f6' : '#fff', cursor: isEditMode ? 'not-allowed' : 'text' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>Jam :</label>
          <input type="time" value={jamRawat} onChange={(e) => setJamRawat(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} readOnly={isEditMode} style={{ ...inputStyle, width: 110, background: isEditMode ? '#f3f4f6' : '#fff', cursor: isEditMode ? 'not-allowed' : 'text' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Kiri — Keluhan (S), Pemeriksaan+Vital Sign (O) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>Keluhan</label>
            <textarea value={keluhan} onChange={(e) => setKeluhan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
          </div>

          <div>
            <label style={labelStyle}>Pemeriksaan</label>
            <textarea value={pemeriksaan} onChange={(e) => setPemeriksaan(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>Tensi</label>
              <input type="text" value={tensi} onChange={(e) => setTensi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} placeholder="120/80" maxLength={8} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nadi</label>
              <input type="text" value={nadi} onChange={(e) => setNadi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={3} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Suhu</label>
              <input type="text" value={suhuTubuh} onChange={(e) => setSuhuTubuh(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Respirasi</label>
              <input type="text" value={respirasi} onChange={(e) => setRespirasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={3} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>SpO2</label>
              <input type="text" value={spo2} onChange={(e) => setSpo2(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={3} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>L.P. (cm)</label>
              <input type="text" value={lingkarPerut} onChange={(e) => setLingkarPerut(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>GCS</label>
              <input type="text" value={gcs} onChange={(e) => setGcs(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={10} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>BB (Kg)</label>
              <input type="text" value={berat} onChange={(e) => setBerat(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>TB (cm)</label>
              <input type="text" value={tinggi} onChange={(e) => setTinggi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={5} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
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
              <label style={labelStyle}>Alergi</label>
              <input type="text" value={alergi} onChange={(e) => setAlergi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={80} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Kanan — Asesmen (A), Planning (P), Instruksi (I), Evaluasi (E) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>Asesmen</label>
            <textarea value={penilaian} onChange={(e) => setPenilaian(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
          </div>

          <div>
            <label style={labelStyle}>Planning</label>
            <textarea value={rtl} onChange={(e) => setRtl(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
          </div>

          <div>
            <label style={labelStyle}>Instruksi/Implementasi</label>
            <textarea value={instruksi} onChange={(e) => setInstruksi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={textareaStyle} />
          </div>

          <div>
            <label style={labelStyle}>Evaluasi</label>
            <textarea value={evaluasi} onChange={(e) => setEvaluasi(e.target.value)} onFocus={handleFieldFocus} onBlur={handleFieldBlur} maxLength={2000} style={{ ...textareaStyle, minHeight: 50 }} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSimpan}
        disabled={saving}
        style={{ padding: '10px 16px', borderRadius: 0, border: 'none', background: saving ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
        onMouseOver={(e) => { if (!saving) e.currentTarget.style.background = '#0891B2'; }}
        onMouseOut={(e) => { if (!saving) e.currentTarget.style.background = '#1AB1E5'; }}
      >
        {saving ? 'Menyimpan...' : isEditMode ? 'Update SOAP/CPPT' : 'Simpan SOAP/CPPT'}
      </button>

      <ModalCariPegawai
        isOpen={showCariPetugas}
        onClose={() => setShowCariPetugas(false)}
        onSelect={(nik, nama) => {
          setPetugasNip(nik);
          setPetugasNama(nama);
        }}
      />
    </div>
  );
};
