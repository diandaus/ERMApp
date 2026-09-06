import React from 'react';
import Swal from 'sweetalert2';
import { ModalCariDokter } from './ModalCariDokter';

export type ResumeRanap = {
  kd_dokter: string;
  nm_dokter: string;
  kd_dokter_pengirim: string;
  nm_dokter_pengirim: string;
  diagnosa_awal: string;
  alasan: string;
  keluhan_utama: string;
  pemeriksaan_fisik: string;
  pemeriksaan_penunjang: string;
  hasil_laborat: string;
  obat_di_rs: string;
  diagnosa_utama: string;
  kd_diagnosa_utama: string;
  diagnosa_sekunder: string;
  kd_diagnosa_sekunder: string;
  diagnosa_sekunder2: string;
  kd_diagnosa_sekunder2: string;
  diagnosa_sekunder3: string;
  kd_diagnosa_sekunder3: string;
  diagnosa_sekunder4: string;
  kd_diagnosa_sekunder4: string;
  diagnosa_sekunder5: string;
  kd_diagnosa_sekunder5: string;
  prosedur_utama: string;
  kd_prosedur_utama: string;
  prosedur_sekunder: string;
  kd_prosedur_sekunder: string;
  prosedur_sekunder2: string;
  kd_prosedur_sekunder2: string;
  prosedur_sekunder3: string;
  kd_prosedur_sekunder3: string;
  prosedur_sekunder4: string;
  kd_prosedur_sekunder4: string;
  prosedur_sekunder5: string;
  kd_prosedur_sekunder5: string;
  konsul_dokter: string;
  edukasi: string;
  cara_keluar: string;
  ket_keluar: string;
  keadaan: string;
  ket_keadaan: string;
  obat_pulang: string;
};

const inputStyle: React.CSSProperties = {
  width: '100%', height: 30, padding: '5px 10px', borderRadius: 4,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: '#111827',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, height: 'auto', resize: 'vertical', minHeight: 70, lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400,
};

const RefBtn: React.FC<{ onClick: () => void; title?: string }> = ({ onClick, title }) => (
  <button type="button" onClick={onClick} title={title}
    style={{ padding: '4px 10px', border: '1px solid #1AB1E5', borderRadius: 2, background: '#fff', color: '#1AB1E5', cursor: 'pointer', fontSize: 12, fontWeight: 400, flexShrink: 0, alignSelf: 'flex-start' }}>
    Lihat
  </button>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 12, fontWeight: 700, color: '#1AB1E5',
    borderBottom: '2px solid #e0f2fe', paddingBottom: 6, marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  }}>
    {children}
  </div>
);

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  half?: boolean;
}> = ({ label, children, half }) => (
  <div style={{ gridColumn: half ? 'span 1' : 'span 2' }}>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

const DiagnosaRow: React.FC<{
  label: string;
  kodeKey: keyof ResumeRanap;
  namaKey: keyof ResumeRanap;
  form: ResumeRanap;
  onChange: (key: keyof ResumeRanap, val: string) => void;
}> = ({ label, kodeKey, namaKey, form, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap', width: 140, flexShrink: 0 }}>
      {label}
    </span>
    <input style={{ ...inputStyle, flex: 1 }} value={form[namaKey] as string}
      onChange={e => onChange(namaKey, e.target.value)} placeholder="Nama diagnosa..." />
    <input style={{ ...inputStyle, width: 100, flexShrink: 0 }} value={form[kodeKey] as string}
      onChange={e => onChange(kodeKey, e.target.value)} placeholder="ICD-10" />
  </div>
);

const ProsedurRow: React.FC<{
  label: string;
  kodeKey: keyof ResumeRanap;
  namaKey: keyof ResumeRanap;
  form: ResumeRanap;
  onChange: (key: keyof ResumeRanap, val: string) => void;
}> = ({ label, kodeKey, namaKey, form, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap', width: 140, flexShrink: 0 }}>
      {label}
    </span>
    <input style={{ ...inputStyle, flex: 1 }} value={form[namaKey] as string}
      onChange={e => onChange(namaKey, e.target.value)} placeholder="Nama prosedur..." />
    <input style={{ ...inputStyle, width: 100, flexShrink: 0 }} value={form[kodeKey] as string}
      onChange={e => onChange(kodeKey, e.target.value)} placeholder="ICD-9-CM" />
  </div>
);

type ModalInputResumeProps = {
  patient: any;
  initialData: ResumeRanap;
  exists: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalInputResume: React.FC<ModalInputResumeProps> = ({ patient, initialData, exists, onClose, onSaved }) => {
  // visible — animasi slide-in dari kanan, PERSIS pola ResepModal.tsx/
  // ResepPulangModal.tsx (ganti dari dialog card mengambang di tengah,
  // radius 20/16), per permintaan user "modifikasi modal resume
  // mengikuti gaya/desain modal tab lainnya".
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const [form, setForm] = React.useState<ResumeRanap>(initialData);
  const [saving, setSaving] = React.useState(false);
  const [dokterOpen, setDokterOpen] = React.useState(false);
  // "Referensi keluhan utama" (RefBtn di field Keluhan Utama) — padanan
  // dialog cari keluhan Java (query pemeriksaan_ralan.no_rawat=? + LIKE
  // tgl_perawatan/keluhan). Diadaptasi ke `pemeriksaan_ranap` krn konteks
  // di sini Rawat Inap, bukan Rawat Jalan — sumber data yg sama dgn tab
  // SOAP/CPPT pasien ini (GET /api/pemeriksaan-ranap/:no_rawat, sudah ada,
  // tidak perlu endpoint baru).
  const [refField, setRefField] = React.useState<string | null>(null);
  const [keluhanHistory, setKeluhanHistory] = React.useState<{ tgl_perawatan: string; jam_rawat: string; keluhan: string; nama: string }[]>([]);
  const [keluhanLoading, setKeluhanLoading] = React.useState(false);
  const [keluhanSearch, setKeluhanSearch] = React.useState('');
  // "Referensi pemeriksaan fisik" — padanan dialog Java yg cari di KEDUA
  // tabel pemeriksaan_ralan + pemeriksaan_ranap (beda dari Keluhan yg cuma
  // ralan), lewat endpoint generik GET /api/riwayat-pemeriksaan/:no_rawat?
  // field=pemeriksaan.
  const [pemeriksaanFisikHistory, setPemeriksaanFisikHistory] = React.useState<{ tgl_perawatan: string; jam_rawat: string; value: string; nama: string }[]>([]);
  const [pemeriksaanFisikLoading, setPemeriksaanFisikLoading] = React.useState(false);
  const [pemeriksaanFisikSearch, setPemeriksaanFisikSearch] = React.useState('');
  // "Referensi Radiologi" — single-select spt Keluhan/Pemeriksaan Fisik,
  // sumber hasil_radiologi (GET /api/riwayat-hasil-radiologi/:no_rawat).
  const [radiologiHistory, setRadiologiHistory] = React.useState<{ tgl_periksa: string; jam: string; hasil: string }[]>([]);
  const [radiologiLoading, setRadiologiLoading] = React.useState(false);
  const [radiologiSearch, setRadiologiSearch] = React.useState('');
  // "Referensi Laboratorium" & "Referensi Obat selama rawatan" — beda dari
  // yg di atas: multi-select via checkbox (padanan kolom "P" di Java) lalu
  // tombol "Tambahkan" meng-APPEND baris terpilih (bukan replace) ke
  // textarea, krn wajar user mau gabungkan beberapa item hasil lab/obat.
  const [laboratHistory, setLaboratHistory] = React.useState<{ tgl_periksa: string; jam: string; pemeriksaan: string; nilai: string; nilai_rujukan: string }[]>([]);
  const [laboratLoading, setLaboratLoading] = React.useState(false);
  const [laboratSearch, setLaboratSearch] = React.useState('');
  const [laboratChecked, setLaboratChecked] = React.useState<Set<number>>(new Set());
  const [obatHistory, setObatHistory] = React.useState<{ tgl_perawatan: string; jam: string; nama_brng: string; jml: number; kode_sat: string }[]>([]);
  const [obatLoading, setObatLoading] = React.useState(false);
  const [obatSearch, setObatSearch] = React.useState('');
  const [obatChecked, setObatChecked] = React.useState<Set<number>>(new Set());

  // Obat Pulang — beda dari field RefBtn lain: langsung terisi OTOMATIS
  // dari resep_pulang (GET /api/resep-pulang/:no_rawat, endpoint yg sudah
  // ada) begitu modal dibuka, tanpa perlu klik apa pun. Hanya isi kalau
  // field masih kosong, supaya tidak menimpa resume yg sudah pernah
  // disimpan/diedit manual sebelumnya.
  React.useEffect(() => {
    if (form.obat_pulang.trim() !== '') return;
    fetch(`/api/resep-pulang/${encodeURIComponent(patient.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { kode_brng: string; nama_brng: string; kode_sat: string; jml: number; dosis: string }[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const grouped = new Map<string, { nama_brng: string; kode_sat: string; dosis: string; jml: number }>();
        data.forEach((item) => {
          const key = `${item.kode_brng}|${item.dosis}`;
          const g = grouped.get(key);
          if (g) g.jml += item.jml;
          else grouped.set(key, { nama_brng: item.nama_brng, kode_sat: item.kode_sat, dosis: item.dosis, jml: item.jml });
        });
        const lines = Array.from(grouped.values()).map((g) =>
          `${g.nama_brng} ${g.jml} ${g.kode_sat}${g.dosis ? ' - ' + g.dosis : ''}`
        );
        setForm((prev) => (prev.obat_pulang.trim() !== '' ? prev : { ...prev, obat_pulang: lines.join('\n') }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.no_rawat]);
  // Kotak modal Input Resume (outer gray box: maxWidth 1000/width 90%/
  // maxHeight 90vh) — DIUKUR LANGSUNG lewat getBoundingClientRect(), bukan
  // ditiru pakai CSS calc()/sizer manual (percobaan sebelumnya masih
  // sedikit meleset krn padding overlay & tinggi konten ikut memengaruhi
  // ukuran akhirnya). Dengan koordinat pixel asli ini, kartu referensi
  // dijamin pas persis sisi kiri/atas/bawahnya berapa pun ukuran layar/
  // kontennya.
  const modalBoxRef = React.useRef<HTMLDivElement>(null);
  const [modalBoxRect, setModalBoxRect] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);

  React.useEffect(() => {
    if (refField !== 'keluhan_utama') return;
    setKeluhanSearch('');
    setKeluhanLoading(true);
    fetch(`/api/pemeriksaan-ranap/${encodeURIComponent(patient.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setKeluhanHistory(Array.isArray(data) ? data : []))
      .catch(() => setKeluhanHistory([]))
      .finally(() => setKeluhanLoading(false));

    const measure = () => {
      if (!modalBoxRef.current) return;
      const r = modalBoxRef.current.getBoundingClientRect();
      setModalBoxRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [refField, patient.no_rawat]);

  React.useEffect(() => {
    if (refField !== 'pemeriksaan_penunjang') return;
    setRadiologiSearch('');
    setRadiologiLoading(true);
    fetch(`/api/riwayat-hasil-radiologi/${encodeURIComponent(patient.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRadiologiHistory(Array.isArray(data) ? data : []))
      .catch(() => setRadiologiHistory([]))
      .finally(() => setRadiologiLoading(false));

    const measure = () => {
      if (!modalBoxRef.current) return;
      const r = modalBoxRef.current.getBoundingClientRect();
      setModalBoxRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [refField, patient.no_rawat]);

  React.useEffect(() => {
    if (refField !== 'hasil_laborat') return;
    setLaboratSearch('');
    setLaboratChecked(new Set());
    setLaboratLoading(true);
    fetch(`/api/riwayat-laborat/${encodeURIComponent(patient.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setLaboratHistory(Array.isArray(data) ? data : []))
      .catch(() => setLaboratHistory([]))
      .finally(() => setLaboratLoading(false));

    const measure = () => {
      if (!modalBoxRef.current) return;
      const r = modalBoxRef.current.getBoundingClientRect();
      setModalBoxRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [refField, patient.no_rawat]);

  React.useEffect(() => {
    if (refField !== 'obat_di_rs') return;
    setObatSearch('');
    setObatChecked(new Set());
    setObatLoading(true);
    fetch(`/api/riwayat-obat-ranap/${encodeURIComponent(patient.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setObatHistory(Array.isArray(data) ? data : []))
      .catch(() => setObatHistory([]))
      .finally(() => setObatLoading(false));

    const measure = () => {
      if (!modalBoxRef.current) return;
      const r = modalBoxRef.current.getBoundingClientRect();
      setModalBoxRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [refField, patient.no_rawat]);

  React.useEffect(() => {
    if (refField !== 'pemeriksaan_fisik') return;
    setPemeriksaanFisikSearch('');
    setPemeriksaanFisikLoading(true);
    fetch(`/api/riwayat-pemeriksaan/${encodeURIComponent(patient.no_rawat)}?field=pemeriksaan`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPemeriksaanFisikHistory(Array.isArray(data) ? data : []))
      .catch(() => setPemeriksaanFisikHistory([]))
      .finally(() => setPemeriksaanFisikLoading(false));

    const measure = () => {
      if (!modalBoxRef.current) return;
      const r = modalBoxRef.current.getBoundingClientRect();
      setModalBoxRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [refField, patient.no_rawat]);
  const [caraKeluarFocused, setCaraKeluarFocused] = React.useState(false);
  const caraKeluarRef = React.useRef<HTMLSelectElement>(null);
  const [keadaanFocused, setKeadaanFocused] = React.useState(false);
  const keadaanRef = React.useRef<HTMLSelectElement>(null);

  const set = (key: keyof ResumeRanap, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.kd_dokter) {
      Swal.fire({ icon: 'warning', title: 'Kode dokter wajib diisi', timer: 2000, showConfirmButton: false });
      return;
    }
    setSaving(true);
    try {
      const method = exists ? 'PUT' : 'POST';
      const res = await fetch('/api/resume-ranap', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: patient.no_rawat, ...form }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menyimpan');
      await Swal.fire({ icon: 'success', title: 'Resume berhasil disimpan', timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Main Modal — panel slide-in dari kanan, PERSIS gaya/desain
          ResepModal.tsx/ResepPulangModal.tsx (overlay fixed + panel anchor
          kanan 90vw krn form resume banyak kolom, header breadcrumb pasien
          + tombol close bulat), ganti dari versi lama (dialog card
          mengambang di tengah, radius 20/16). modalBoxRef tetap dipasang
          di panel ini — posisi/ukuran kartu "Cari Riwayat ..." di bawah
          diukur dinamis dari sini via getBoundingClientRect, jadi otomatis
          ikut bentuk panel baru tanpa perlu ubah logicnya. */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
        onClick={onClose}
      >
        <div
          ref={modalBoxRef}
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '50vw', maxWidth: '1100px',
            background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header — breadcrumb pasien + close button bulat, PERSIS pola ResepModal.tsx. */}
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
              <span style={{ fontSize: 12, background: exists ? '#fef3c7' : '#dcfce7', color: exists ? '#92400e' : '#166534', borderRadius: 6, padding: '2px 8px', fontWeight: 400 }}>
                {exists ? 'Edit Resume' : 'Resume Baru'}
              </span>
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
            >×</button>
          </div>

          {/* Body — scrollable, flat (tanpa nested white-card-dlm-card spt versi lama). */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, minHeight: 0 }}>

            {/* Dokter */}
            <div style={{ marginBottom: 20 }}>
              <SectionTitle>Dokter</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Dokter Pengirim — auto-fill dari reg_periksa */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400 }}>
                    Dokter IGD :
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="text" value={form.nm_dokter_pengirim} readOnly placeholder="Nama dokter pengirim"
                      style={{ flex: 1, height: 30, padding: '5px 10px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#f9fafb', color: '#374151' }} />
                  </div>
                </div>
                {/* Dokter PJ */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#374151', fontWeight: 400 }}>
                    DPJP :
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" value={form.nm_dokter} readOnly placeholder="Nama dokter"
                      style={{ width: '100%', height: 30, padding: '5px 34px 5px 10px', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#f9fafb', color: '#374151' }} />
                    <button type="button" onClick={() => setDokterOpen(true)} title="Pilih dokter PJ"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, padding: 0, border: 'none', borderRadius: 4, background: '#1AB1E5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
                        <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <ModalCariDokter
              isOpen={dokterOpen}
              onClose={() => setDokterOpen(false)}
              onSelect={(kode, nama) => {
                setForm(f => ({ ...f, kd_dokter: kode, nm_dokter: nama }));
                setDokterOpen(false);
              }}
            />

            {/* Anamnesis */}
            <div style={{ marginBottom: 20 }}>
              <SectionTitle>Anamnesis</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Diagnosa Awal" half>
                  <input style={inputStyle} value={form.diagnosa_awal}
                    onChange={e => set('diagnosa_awal', e.target.value)} placeholder="Diagnosa awal masuk..." />
                </Field>
                <Field label="Alasan Masuk RS" half>
                  <input style={inputStyle} value={form.alasan}
                    onChange={e => set('alasan', e.target.value)} placeholder="Alasan masuk RS..." />
                </Field>
                <Field label="Keluhan Utama" half={false}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <textarea style={{ ...textareaStyle, flex: 1 }} value={form.keluhan_utama}
                      onChange={e => set('keluhan_utama', e.target.value)} placeholder="Keluhan utama pasien..." />
                    <RefBtn onClick={() => setRefField('keluhan_utama')} title="Referensi keluhan utama" />
                  </div>
                </Field>
              </div>
            </div>

            {/* Pemeriksaan */}
            <div style={{ marginBottom: 20 }}>
              <SectionTitle>Pemeriksaan</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Pemeriksaan Fisik">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <textarea style={{ ...textareaStyle, flex: 1 }} value={form.pemeriksaan_fisik}
                      onChange={e => set('pemeriksaan_fisik', e.target.value)} placeholder="Hasil pemeriksaan fisik..." />
                    <RefBtn onClick={() => setRefField('pemeriksaan_fisik')} title="Referensi pemeriksaan fisik" />
                  </div>
                </Field>
                <Field label="Radiologi">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <textarea style={{ ...textareaStyle, flex: 1 }} value={form.pemeriksaan_penunjang}
                      onChange={e => set('pemeriksaan_penunjang', e.target.value)} placeholder="Pemeriksaan penunjang..." />
                    <RefBtn onClick={() => setRefField('pemeriksaan_penunjang')} title="Referensi pemeriksaan penunjang" />
                  </div>
                </Field>
                <Field label="Laboratorium" half={false}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <textarea style={{ ...textareaStyle, flex: 1 }} value={form.hasil_laborat}
                      onChange={e => set('hasil_laborat', e.target.value)} placeholder="Hasil laboratorium..." />
                    <RefBtn onClick={() => setRefField('hasil_laborat')} title="Referensi hasil laboratorium" />
                  </div>
                </Field>
                <Field label="Obat selama rawatan" half={false}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <textarea style={{ ...textareaStyle, flex: 1 }} value={form.obat_di_rs}
                      onChange={e => set('obat_di_rs', e.target.value)} placeholder="Terapi obat selama di RS..." />
                    <RefBtn onClick={() => setRefField('obat_di_rs')} title="Referensi obat di RS" />
                  </div>
                </Field>
              </div>
            </div>

            {/* Diagnosa */}
            <div style={{ marginBottom: 20 }}>
              <SectionTitle>Diagnosa</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <DiagnosaRow label="Diagnosa Utama" kodeKey="kd_diagnosa_utama" namaKey="diagnosa_utama" form={form} onChange={set} />
                <DiagnosaRow label="Diagnosa Sekunder 1" kodeKey="kd_diagnosa_sekunder" namaKey="diagnosa_sekunder" form={form} onChange={set} />
                <DiagnosaRow label="Diagnosa Sekunder 2" kodeKey="kd_diagnosa_sekunder2" namaKey="diagnosa_sekunder2" form={form} onChange={set} />
                <DiagnosaRow label="Diagnosa Sekunder 3" kodeKey="kd_diagnosa_sekunder3" namaKey="diagnosa_sekunder3" form={form} onChange={set} />
                <DiagnosaRow label="Diagnosa Sekunder 4" kodeKey="kd_diagnosa_sekunder4" namaKey="diagnosa_sekunder4" form={form} onChange={set} />
                <DiagnosaRow label="Diagnosa Sekunder 5" kodeKey="kd_diagnosa_sekunder5" namaKey="diagnosa_sekunder5" form={form} onChange={set} />
              </div>
            </div>

            {/* Prosedur */}
            <div style={{ marginBottom: 20 }}>
              <SectionTitle>Prosedur / Tindakan</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ProsedurRow label="Prosedur Utama" kodeKey="kd_prosedur_utama" namaKey="prosedur_utama" form={form} onChange={set} />
                <ProsedurRow label="Prosedur Sekunder 1" kodeKey="kd_prosedur_sekunder" namaKey="prosedur_sekunder" form={form} onChange={set} />
                <ProsedurRow label="Prosedur Sekunder 2" kodeKey="kd_prosedur_sekunder2" namaKey="prosedur_sekunder2" form={form} onChange={set} />
                <ProsedurRow label="Prosedur Sekunder 3" kodeKey="kd_prosedur_sekunder3" namaKey="prosedur_sekunder3" form={form} onChange={set} />
                <ProsedurRow label="Prosedur Sekunder 4" kodeKey="kd_prosedur_sekunder4" namaKey="prosedur_sekunder4" form={form} onChange={set} />
                <ProsedurRow label="Prosedur Sekunder 5" kodeKey="kd_prosedur_sekunder5" namaKey="prosedur_sekunder5" form={form} onChange={set} />
              </div>
            </div>

            {/* Konsultasi & Edukasi */}
            <div style={{ marginBottom: 20 }}>
              <SectionTitle>Konsultasi & Edukasi</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Konsultasi Dokter</label>
                  <textarea style={textareaStyle} value={form.konsul_dokter}
                    onChange={e => set('konsul_dokter', e.target.value)} placeholder="Konsultasi dokter..." />
                </div>
                <div>
                  <label style={labelStyle}>Edukasi</label>
                  <textarea style={textareaStyle} value={form.edukasi}
                    onChange={e => set('edukasi', e.target.value)} placeholder="Edukasi yang diberikan..." />
                </div>
              </div>
            </div>

            {/* Kondisi Keluar */}
            <div style={{ marginBottom: 20 }}>
              <SectionTitle>Kondisi Keluar</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cara Keluar</label>
                  <div style={{ position: 'relative', border: `1px solid ${caraKeluarFocused ? '#2563eb' : '#d1d5db'}`, borderRadius: 4, background: '#fff', transition: 'border-color 0.15s', height: 30, boxSizing: 'border-box' }}>
                    <select
                      ref={caraKeluarRef}
                      value={form.cara_keluar}
                      onChange={e => set('cara_keluar', e.target.value)}
                      onFocus={() => setCaraKeluarFocused(true)}
                      onBlur={() => setCaraKeluarFocused(false)}
                      style={{ width: '100%', height: '100%', padding: '0 36px 0 10px', border: 'none', borderRadius: 4, fontSize: 13, outline: 'none', background: 'transparent', color: '#111827', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="">-- Pilih --</option>
                      <option value="Sembuh">Sembuh</option>
                      <option value="Rujuk">Rujuk</option>
                      <option value="Pulang Paksa">Pulang Paksa</option>
                      <option value="Meninggal">Meninggal</option>
                      <option value="Lain-lain">Lain-lain</option>
                    </select>
                    <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#1AB1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
                        <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Keterangan Keluar</label>
                  <input style={inputStyle} value={form.ket_keluar}
                    onChange={e => set('ket_keluar', e.target.value)} placeholder="Keterangan keluar..." />
                </div>
                <div>
                  <label style={labelStyle}>Keadaan Pulang</label>
                  <div style={{ position: 'relative', border: `1px solid ${keadaanFocused ? '#2563eb' : '#d1d5db'}`, borderRadius: 4, background: '#fff', transition: 'border-color 0.15s', height: 30, boxSizing: 'border-box' }}>
                    <select
                      ref={keadaanRef}
                      value={form.keadaan}
                      onChange={e => set('keadaan', e.target.value)}
                      onFocus={() => setKeadaanFocused(true)}
                      onBlur={() => setKeadaanFocused(false)}
                      style={{ width: '100%', height: '100%', padding: '0 36px 0 10px', border: 'none', borderRadius: 4, fontSize: 13, outline: 'none', background: 'transparent', color: '#111827', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="">-- Pilih --</option>
                      <option value="Baik">Baik</option>
                      <option value="Sedang">Sedang</option>
                      <option value="Buruk">Buruk</option>
                    </select>
                    <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: 4, background: '#1AB1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
                        <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Keterangan Keadaan</label>
                  <input style={inputStyle} value={form.ket_keadaan}
                    onChange={e => set('ket_keadaan', e.target.value)} placeholder="Keterangan keadaan..." />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Obat Pulang</label>
                  <textarea style={textareaStyle} value={form.obat_pulang}
                    onChange={e => set('obat_pulang', e.target.value)} placeholder="Obat yang dibawa pulang..." />
                </div>
              </div>
            </div>

          </div>

          {/* Footer — sticky, di luar area scroll body, tombol Simpan
              full-width flat radius 2, PERSIS pola ModalInputLab.tsx/
              ResepPulangModal.tsx. Tutup dihapus, masih bisa lewat
              overlay/tombol close di header. */}
          <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 2, border: 'none', background: saving ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
              onMouseOver={(e) => { if (!saving) e.currentTarget.style.background = '#0891B2'; }}
              onMouseOut={(e) => { if (!saving) e.currentTarget.style.background = '#1AB1E5'; }}
            >
              {saving ? 'Menyimpan...' : exists ? 'Update Resume' : 'Simpan Resume'}
            </button>
          </div>
        </div>
      </div>

      {/* Cari Riwayat Keluhan — muncul saat RefBtn field Keluhan Utama diklik.
          Posisi/ukuran kartu diambil dari modalBoxRect (getBoundingClientRect
          modal Input Resume, diukur di useEffect di atas) — left/top/height
          persis sama dgn modal itu, width separuhnya. */}
      {refField === 'keluhan_utama' && modalBoxRect && (
        <div
          onClick={() => setRefField(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10002 }}
        >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: modalBoxRect.top,
                left: modalBoxRect.left,
                width: modalBoxRect.width * 0.6,
                height: modalBoxRect.height,
                background: '#ffffff', borderRadius: 0, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: '0 20px 48px rgba(0,0,0,0.2)', boxSizing: 'border-box',
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#111827' }}>Cari Riwayat Keluhan</div>
              <button type="button" onClick={() => setRefField(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <input
              type="text"
              value={keluhanSearch}
              onChange={(e) => setKeluhanSearch(e.target.value)}
              placeholder="Cari tanggal atau keluhan..."
              autoFocus
              style={{ padding: '8px 12px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Tanggal</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Jam</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Keluhan</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Dokter/Paramedis</th>
                  </tr>
                </thead>
                <tbody>
                  {keluhanLoading ? (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
                  ) : (() => {
                    const q = keluhanSearch.trim().toLowerCase();
                    const filtered = keluhanHistory.filter((item) =>
                      !q || (item.tgl_perawatan || '').toLowerCase().includes(q) || (item.keluhan || '').toLowerCase().includes(q)
                    );
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td>
                        </tr>
                      );
                    }
                    return filtered.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => { set('keluhan_utama', item.keluhan || ''); setRefField(null); }}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.tgl_perawatan}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.jam_rawat}</td>
                        <td style={{ padding: '7px 10px', color: '#111827' }}>{item.keluhan || '-'}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.nama || '-'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cari Riwayat Pemeriksaan Fisik — muncul saat RefBtn field
          Pemeriksaan Fisik diklik. Sumber dari kedua tabel pemeriksaan_ralan
          + pemeriksaan_ranap (GET /api/riwayat-pemeriksaan). Posisi/ukuran
          sama seperti kartu Cari Riwayat Keluhan di atas. */}
      {refField === 'pemeriksaan_fisik' && modalBoxRect && (
        <div
          onClick={() => setRefField(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10002 }}
        >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: modalBoxRect.top,
                left: modalBoxRect.left,
                width: modalBoxRect.width * 0.6,
                height: modalBoxRect.height,
                background: '#ffffff', borderRadius: 0, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: '0 20px 48px rgba(0,0,0,0.2)', boxSizing: 'border-box',
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#111827' }}>Cari Riwayat Pemeriksaan Fisik</div>
              <button type="button" onClick={() => setRefField(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <input
              type="text"
              value={pemeriksaanFisikSearch}
              onChange={(e) => setPemeriksaanFisikSearch(e.target.value)}
              placeholder="Cari tanggal atau pemeriksaan..."
              autoFocus
              style={{ padding: '8px 12px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Tanggal</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Jam</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Pemeriksaan</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Dokter/Paramedis</th>
                  </tr>
                </thead>
                <tbody>
                  {pemeriksaanFisikLoading ? (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
                  ) : (() => {
                    const q = pemeriksaanFisikSearch.trim().toLowerCase();
                    const filtered = pemeriksaanFisikHistory.filter((item) =>
                      !q || (item.tgl_perawatan || '').toLowerCase().includes(q) || (item.value || '').toLowerCase().includes(q)
                    );
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td>
                        </tr>
                      );
                    }
                    return filtered.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => { set('pemeriksaan_fisik', item.value || ''); setRefField(null); }}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.tgl_perawatan}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.jam_rawat}</td>
                        <td style={{ padding: '7px 10px', color: '#111827' }}>{item.value || '-'}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.nama || '-'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cari Riwayat Radiologi — single-select spt Keluhan/Pemeriksaan
          Fisik. Sumber hasil_radiologi (GET /api/riwayat-hasil-radiologi). */}
      {refField === 'pemeriksaan_penunjang' && modalBoxRect && (
        <div
          onClick={() => setRefField(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10002 }}
        >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: modalBoxRect.top,
                left: modalBoxRect.left,
                width: modalBoxRect.width * 0.6,
                height: modalBoxRect.height,
                background: '#ffffff', borderRadius: 0, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: '0 20px 48px rgba(0,0,0,0.2)', boxSizing: 'border-box',
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#111827' }}>Cari Riwayat Radiologi</div>
              <button type="button" onClick={() => setRefField(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <input
              type="text"
              value={radiologiSearch}
              onChange={(e) => setRadiologiSearch(e.target.value)}
              placeholder="Cari tanggal atau hasil pemeriksaan..."
              autoFocus
              style={{ padding: '8px 12px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Tanggal</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Jam</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Hasil Pemeriksaan</th>
                  </tr>
                </thead>
                <tbody>
                  {radiologiLoading ? (
                    <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
                  ) : (() => {
                    const q = radiologiSearch.trim().toLowerCase();
                    const filtered = radiologiHistory.filter((item) =>
                      !q || (item.tgl_periksa || '').toLowerCase().includes(q) || (item.hasil || '').toLowerCase().includes(q)
                    );
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td>
                        </tr>
                      );
                    }
                    return filtered.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => { set('pemeriksaan_penunjang', item.hasil || ''); setRefField(null); }}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.tgl_periksa}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.jam}</td>
                        <td style={{ padding: '7px 10px', color: '#111827', whiteSpace: 'pre-line' }}>{item.hasil || '-'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cari Riwayat Laboratorium — checkbox multi-select (padanan kolom
          "P" di Java) + tombol "Tambahkan" yg meng-APPEND baris terpilih
          ke textarea hasil_laborat (bukan replace, krn biasanya user mau
          gabungkan beberapa item hasil lab). */}
      {refField === 'hasil_laborat' && modalBoxRect && (
        <div
          onClick={() => setRefField(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10002 }}
        >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: modalBoxRect.top,
                left: modalBoxRect.left,
                width: modalBoxRect.width * 0.6,
                height: modalBoxRect.height,
                background: '#ffffff', borderRadius: 0, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: '0 20px 48px rgba(0,0,0,0.2)', boxSizing: 'border-box',
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#111827' }}>Cari Riwayat Laboratorium</div>
              <button type="button" onClick={() => setRefField(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <input
              type="text"
              value={laboratSearch}
              onChange={(e) => setLaboratSearch(e.target.value)}
              placeholder="Cari tanggal atau nama pemeriksaan..."
              autoFocus
              style={{ padding: '8px 12px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', width: 30 }}></th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Tanggal</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Jam</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Hasil Pemeriksaan</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Nilai Normal</th>
                  </tr>
                </thead>
                <tbody>
                  {laboratLoading ? (
                    <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
                  ) : (() => {
                    const q = laboratSearch.trim().toLowerCase();
                    const filtered = laboratHistory
                      .map((item, idx) => ({ item, idx }))
                      .filter(({ item }) =>
                        !q || (item.tgl_periksa || '').toLowerCase().includes(q) || (item.pemeriksaan || '').toLowerCase().includes(q)
                      );
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td>
                        </tr>
                      );
                    }
                    return filtered.map(({ item, idx }) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          setLaboratChecked((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx); else next.add(idx);
                            return next;
                          });
                        }}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: laboratChecked.has(idx) ? '#eff6ff' : 'transparent' }}
                      >
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <input type="checkbox" checked={laboratChecked.has(idx)} onChange={() => {}} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.tgl_periksa}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.jam}</td>
                        <td style={{ padding: '7px 10px', color: '#111827' }}>{item.pemeriksaan || '-'}: {item.nilai || '-'}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.nilai_rujukan || '-'}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={laboratChecked.size === 0}
              onClick={() => {
                const lines = laboratHistory
                  .filter((_, idx) => laboratChecked.has(idx))
                  .map((item) => `${item.pemeriksaan}: ${item.nilai} (Normal: ${item.nilai_rujukan || '-'})`);
                if (lines.length > 0) {
                  const existing = form.hasil_laborat ? form.hasil_laborat + '\n' : '';
                  set('hasil_laborat', existing + lines.join('\n'));
                }
                setRefField(null);
              }}
              style={{
                padding: '8px 16px', borderRadius: 0, border: 'none', alignSelf: 'flex-end',
                background: laboratChecked.size === 0 ? '#9ca3af' : '#2563eb', color: '#fff',
                cursor: laboratChecked.size === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500,
              }}
            >Masukan {laboratChecked.size > 0 ? `(${laboratChecked.size})` : ''}</button>
          </div>
        </div>
      )}

      {/* Cari Riwayat Obat selama rawatan — checkbox multi-select spt
          Laboratorium. Sumber detail_pemberian_obat (GET
          /api/riwayat-obat-ranap). */}
      {refField === 'obat_di_rs' && modalBoxRect && (
        <div
          onClick={() => setRefField(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10002 }}
        >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: modalBoxRect.top,
                left: modalBoxRect.left,
                width: modalBoxRect.width * 0.6,
                height: modalBoxRect.height,
                background: '#ffffff', borderRadius: 0, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 12,
                boxShadow: '0 20px 48px rgba(0,0,0,0.2)', boxSizing: 'border-box',
              }}
            >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#111827' }}>Cari Riwayat Obat Selama Rawatan</div>
              <button type="button" onClick={() => setRefField(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <input
              type="text"
              value={obatSearch}
              onChange={(e) => setObatSearch(e.target.value)}
              placeholder="Cari tanggal atau nama obat..."
              autoFocus
              style={{ padding: '8px 12px', borderRadius: 0, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', width: 30 }}></th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Tanggal</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Jam</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>Obat Diberikan</th>
                  </tr>
                </thead>
                <tbody>
                  {obatLoading ? (
                    <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
                  ) : (() => {
                    const q = obatSearch.trim().toLowerCase();
                    const filtered = obatHistory
                      .map((item, idx) => ({ item, idx }))
                      .filter(({ item }) =>
                        !q || (item.tgl_perawatan || '').toLowerCase().includes(q) || (item.nama_brng || '').toLowerCase().includes(q)
                      );
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td>
                        </tr>
                      );
                    }
                    return filtered.map(({ item, idx }) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          setObatChecked((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx); else next.add(idx);
                            return next;
                          });
                        }}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6', background: obatChecked.has(idx) ? '#eff6ff' : 'transparent' }}
                      >
                        <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                          <input type="checkbox" checked={obatChecked.has(idx)} onChange={() => {}} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.tgl_perawatan}</td>
                        <td style={{ padding: '7px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{item.jam}</td>
                        <td style={{ padding: '7px 10px', color: '#111827' }}>{item.nama_brng || '-'} ({item.jml} {item.kode_sat})</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={obatChecked.size === 0}
              onClick={() => {
                const lines = obatHistory
                  .filter((_, idx) => obatChecked.has(idx))
                  .map((item) => `${item.nama_brng} - ${item.jml} ${item.kode_sat}`);
                if (lines.length > 0) {
                  const existing = form.obat_di_rs ? form.obat_di_rs + '\n' : '';
                  set('obat_di_rs', existing + lines.join('\n'));
                }
                setRefField(null);
              }}
              style={{
                padding: '8px 16px', borderRadius: 0, border: 'none', alignSelf: 'flex-end',
                background: obatChecked.size === 0 ? '#9ca3af' : '#2563eb', color: '#fff',
                cursor: obatChecked.size === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500,
              }}
            >Masukan {obatChecked.size > 0 ? `(${obatChecked.size})` : ''}</button>
          </div>
        </div>
      )}
    </>
  );
};
