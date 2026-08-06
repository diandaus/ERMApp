import React from 'react';
import Swal from 'sweetalert2';
import type { ResepRalanRow } from '../modules/PermintaanResep';

// ============================================================================
// Modal "Pertanyaan Baru — Informasi Obat" — padanan bagian pertanyaan
// (form utama, BUKAN WindowInput jawaban) di
// permintaan/DlgPermintaanPelayananInformasiObat.java, dipanggil dari
// tombol "Informasi Obat" di sub-tab "Belum Ada Pertanyaan"
// (TabInformasiObat, PermintaanResep.tsx) — tombol toolbar dengan pola
// yang SAMA dengan BtnKonselingFarmasi.
//
// Modal ini MURNI untuk membuat pertanyaan PIO baru (satu no_rawat bisa
// punya banyak pertanyaan independen — lihat komentar di
// backend/permintaan_resep_informasi_obat_handler.go). Menjawab/menghapus
// pertanyaan yang SUDAH ADA dipindah ke ModalJawabPio.tsx (dibuka dari
// tombol "Jawab" di sub-tab "Sudah Ada Pertanyaan"), supaya tiap modal
// fokus satu tugas — tidak perlu daftar pertanyaan lama di sini karena
// sub-tab "Belum Ada Pertanyaan" cuma menampilkan kunjungan yang memang
// belum punya entri PIO sama sekali.
// ============================================================================

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 20, height: 20, borderRadius: '30%', background: '#059669',
      display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const METODE_OPTIONS = ['Lisan', 'Tertulis', 'Telepon'];
const STATUS_PENANYA_OPTIONS = ['Pasien', 'Keluarga Pasien', 'Petugas Kesehatan'];
const JENIS_PERTANYAAN_OPTIONS = [
  'Identifikasi Obat', 'Interaksi Obat', 'Harga Obat', 'Kontraindikasi', 'Cara Pemakaian',
  'Stabilitas', 'Dosis', 'Keracunan', 'Efek Samping Obat', 'Penggunaan Terapeutik',
  'Farmakokinetika', 'Farmakodinamika', 'Ketersediaan Obat', 'Lain-lain',
];

// Dipakai bersama ModalJawabPio.tsx (satu entri PIO + jawabannya, dari
// GET /api/permintaan-resep/informasi-obat).
export type InformasiObatItem = {
  no_permintaan: string;
  no_rawat: string;
  tanggal: string;
  metode: string;
  penanya: string;
  status_penanya: string;
  no_telp_penanya: string;
  jenis_pertanyaan: string;
  keterangan_jenis_pertanyaan: string;
  uraian_pertanyaan: string;
  sudah_dijawab: boolean;
  tanggal_jawab: string;
  metode_jawab: string;
  penyampaian_jawaban: string;
  jawaban: string;
  referensi: string;
  nip_apoteker: string;
  nama_apoteker: string;
};

type PertanyaanForm = {
  metode: string;
  penanya: string;
  status_penanya: string;
  no_telp_penanya: string;
  jenis_pertanyaan: string;
  keterangan_jenis_pertanyaan: string;
  uraian_pertanyaan: string;
};

const DEFAULT_PERTANYAAN_FORM: PertanyaanForm = {
  metode: 'Lisan',
  penanya: '',
  status_penanya: 'Pasien',
  no_telp_penanya: '',
  jenis_pertanyaan: 'Identifikasi Obat',
  keterangan_jenis_pertanyaan: '',
  uraian_pertanyaan: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  padding: '7px 32px 7px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none',
  background: '#fff', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', width: '100%',
};
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 56, fontFamily: 'inherit' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };

// Pill "Tanggal : [tanggal]  Jam : [hh] [mm] [ss]" — padanan TanggalPermintaan
// (JXDatePicker + spinner jam/menit/detik) di dialog Java, disamakan
// pola/style-nya dengan Row "Tanggal" di ModalValidasiObat.tsx (pillInput/
// PillSelect diduplikasi di sini mengikuti pola yang sama: hindari impor
// lintas modal, tiap modal berdiri sendiri — StepperIcon-nya dibuat hijau
// (bukan biru seperti ModalValidasiObat) biar konsisten dengan dropdown
// lain di modal ini. Sekadar
// tampilan (waktu default = sekarang, dikunci lewat checkbox "Waktu
// Sekarang") — backend tetap pakai NOW() saat Simpan, sama seperti
// Tanggal di ModalValidasiObat yang juga tidak dikirim ke server.
const pillInput: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none',
  boxSizing: 'border-box', background: '#ffffff', color: '#111827',
};
const pillReadOnly: React.CSSProperties = { ...pillInput, background: '#f9fafb', color: '#374151' };
const pillSelectStyle: React.CSSProperties = { ...pillInput, appearance: 'none', WebkitAppearance: 'none', paddingRight: 30, cursor: 'pointer', width: '100%' };

const PillStepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 20, height: 20, borderRadius: '30%', background: '#059669',
      display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const PillSelect: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }> = ({ value, onChange, options, disabled }) => (
  <div style={{ position: 'relative', width: 60, flexShrink: 0 }}>
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...pillSelectStyle, ...(disabled ? { background: '#f9fafb', cursor: 'default' } : {}) }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <PillStepperIcon />
  </div>
);

const pad2 = (n: number) => String(n).padStart(2, '0');
const range = (n: number) => Array.from({ length: n }, (_, i) => ({ value: pad2(i), label: pad2(i) }));

type ModalInformasiObatProps = {
  resep: ResepRalanRow | null;
  onClose: () => void;
  onSaved: () => void;
  // onJawabLangsung — dipanggil kalau user pilih "Jawab Langsung" di
  // notif sukses (bukan "Tidak"). Parent (PermintaanResep.tsx) yang
  // tahu cara buka ModalJawabPio; resep dikirim balik lewat parameter
  // (bukan andalkan closure) supaya tidak rawan stale kalau state
  // parent berubah di antara modal ini dibuka & disimpan.
  onJawabLangsung?: (resep: ResepRalanRow) => void;
};

export const ModalInformasiObat: React.FC<ModalInformasiObatProps> = ({ resep, onClose, onSaved, onJawabLangsung }) => {
  const [newForm, setNewForm] = React.useState<PertanyaanForm>(DEFAULT_PERTANYAAN_FORM);
  const [savingNew, setSavingNew] = React.useState(false);

  const now = React.useMemo(() => new Date(), []);
  const [tanggal, setTanggal] = React.useState(() => now.toISOString().slice(0, 10));
  const [jam, setJam] = React.useState(() => pad2(now.getHours()));
  const [menit, setMenit] = React.useState(() => pad2(now.getMinutes()));
  const [detik, setDetik] = React.useState(() => pad2(now.getSeconds()));
  const [waktuOtomatis, setWaktuOtomatis] = React.useState(true);

  React.useEffect(() => {
    if (!waktuOtomatis) return;
    const t = setInterval(() => {
      const n = new Date();
      setJam(pad2(n.getHours()));
      setMenit(pad2(n.getMinutes()));
      setDetik(pad2(n.getSeconds()));
    }, 1000);
    return () => clearInterval(t);
  }, [waktuOtomatis]);

  React.useEffect(() => {
    if (!resep) return;
    setNewForm({ ...DEFAULT_PERTANYAAN_FORM, penanya: resep.nm_pasien });
    // Penanya default = pasien sendiri, jadi No. Telp diisi otomatis dari
    // no_tlp pasien (padanan kolom pasien.no_tlp yang sama dipakai Java di
    // tbObat) — tetap bisa diedit manual kalau penanyanya ganti jadi
    // keluarga/petugas kesehatan dengan nomor lain.
    fetch(`/api/pendaftaran/pasien/${encodeURIComponent(resep.no_rkm_medis)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.no_tlp) setNewForm((prev) => ({ ...prev, no_telp_penanya: data.no_tlp }));
      })
      .catch(() => {});
  }, [resep]);

  if (!resep) return null;

  const setNewField = <K extends keyof PertanyaanForm>(key: K, value: PertanyaanForm[K]) => {
    setNewForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSimpanPertanyaan = async () => {
    if (!newForm.penanya.trim()) {
      Swal.fire({ icon: 'warning', title: 'Penanya wajib diisi' });
      return;
    }
    if (!newForm.no_telp_penanya.trim()) {
      Swal.fire({ icon: 'warning', title: 'No. Telp wajib diisi' });
      return;
    }
    if (!newForm.uraian_pertanyaan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Uraian Pertanyaan wajib diisi' });
      return;
    }
    setSavingNew(true);
    try {
      const res = await fetch('/api/permintaan-resep/informasi-obat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: resep.no_rawat, ...newForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pertanyaan');
      onSaved();
      const confirm = await Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Pertanyaan tersimpan. Mau langsung dijawab sekarang?',
        showCancelButton: true,
        confirmButtonText: 'Jawab Langsung',
        cancelButtonText: 'Tidak',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
      });
      onClose();
      if (confirm.isConfirmed) {
        onJawabLangsung?.(resep);
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 640, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          Pelayanan Informasi Obat — {resep.nm_pasien} ({resep.no_rkm_medis})
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: '#111827' }}>Tanggal :</div>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            disabled={waktuOtomatis}
            style={{ ...(waktuOtomatis ? pillReadOnly : pillInput), width: 148 }}
          />
          <div style={{ fontSize: 12.5, color: '#111827', marginLeft: 6 }}>Jam :</div>
          <PillSelect value={jam} onChange={setJam} options={range(24)} disabled={waktuOtomatis} />
          <PillSelect value={menit} onChange={setMenit} options={range(60)} disabled={waktuOtomatis} />
          <PillSelect value={detik} onChange={setDetik} options={range(60)} disabled={waktuOtomatis} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6b7280', cursor: 'pointer' }}>
            <input type="checkbox" checked={waktuOtomatis} onChange={(e) => setWaktuOtomatis(e.target.checked)} style={{ accentColor: '#059669' }} />
            Waktu Sekarang
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Penanya</label>
              <input type="text" maxLength={70} style={inputStyle} value={newForm.penanya} onChange={(e) => setNewField('penanya', e.target.value)} />
            </div>
            <div style={{ width: 180 }}>
              <label style={labelStyle}>Status Penanya</label>
              <div style={{ position: 'relative' }}>
                <select style={selectStyle} value={newForm.status_penanya} onChange={(e) => setNewField('status_penanya', e.target.value)}>
                  {STATUS_PENANYA_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <StepperIcon />
              </div>
            </div>
            <div style={{ width: 150 }}>
              <label style={labelStyle}>No. Telp</label>
              <input type="text" maxLength={30} style={inputStyle} value={newForm.no_telp_penanya} onChange={(e) => setNewField('no_telp_penanya', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 160 }}>
              <label style={labelStyle}>Metode</label>
              <div style={{ position: 'relative' }}>
                <select style={selectStyle} value={newForm.metode} onChange={(e) => setNewField('metode', e.target.value)}>
                  {METODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <StepperIcon />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Jenis Pertanyaan</label>
              <div style={{ position: 'relative' }}>
                <select style={selectStyle} value={newForm.jenis_pertanyaan} onChange={(e) => setNewField('jenis_pertanyaan', e.target.value)}>
                  {JENIS_PERTANYAAN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <StepperIcon />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Keterangan Jenis Pertanyaan</label>
              <input type="text" maxLength={30} style={inputStyle} value={newForm.keterangan_jenis_pertanyaan} onChange={(e) => setNewField('keterangan_jenis_pertanyaan', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Uraian Pertanyaan</label>
            <textarea maxLength={500} rows={3} style={textareaStyle} value={newForm.uraian_pertanyaan} onChange={(e) => setNewField('uraian_pertanyaan', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSimpanPertanyaan}
            disabled={savingNew}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: savingNew ? '#9ca3af' : '#059669', color: '#fff', cursor: savingNew ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {savingNew ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};
