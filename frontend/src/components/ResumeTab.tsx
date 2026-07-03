import React from 'react';
import Swal from 'sweetalert2';
import { ModalCariDokter } from './ModalCariDokter';

type ResumeTabProps = {
  patient: any;
};

type ResumeRanap = {
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

const empty: ResumeRanap = {
  kd_dokter: '', nm_dokter: '',
  kd_dokter_pengirim: '', nm_dokter_pengirim: '',
  diagnosa_awal: '', alasan: '', keluhan_utama: '',
  pemeriksaan_fisik: '', pemeriksaan_penunjang: '', hasil_laborat: '',
  obat_di_rs: '',
  diagnosa_utama: '', kd_diagnosa_utama: '',
  diagnosa_sekunder: '', kd_diagnosa_sekunder: '',
  diagnosa_sekunder2: '', kd_diagnosa_sekunder2: '',
  diagnosa_sekunder3: '', kd_diagnosa_sekunder3: '',
  diagnosa_sekunder4: '', kd_diagnosa_sekunder4: '',
  diagnosa_sekunder5: '', kd_diagnosa_sekunder5: '',
  prosedur_utama: '', kd_prosedur_utama: '',
  prosedur_sekunder: '', kd_prosedur_sekunder: '',
  prosedur_sekunder2: '', kd_prosedur_sekunder2: '',
  prosedur_sekunder3: '', kd_prosedur_sekunder3: '',
  prosedur_sekunder4: '', kd_prosedur_sekunder4: '',
  prosedur_sekunder5: '', kd_prosedur_sekunder5: '',
  konsul_dokter: '', edukasi: '',
  cara_keluar: '', ket_keluar: '',
  keadaan: '', ket_keadaan: '',
  obat_pulang: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: '#111827',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', minHeight: 70, lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block',
};

const RefBtn: React.FC<{ onClick: () => void; title?: string }> = ({ onClick, title }) => (
  <button type="button" onClick={onClick} title={title}
    style={{ padding: '2px 2px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-start' }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
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

export const ResumeTab: React.FC<ResumeTabProps> = ({ patient }) => {
  const [form, setForm] = React.useState<ResumeRanap>(empty);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [exists, setExists] = React.useState(false);
  const [dokterOpen, setDokterOpen] = React.useState(false);
  const [refField, setRefField] = React.useState<string | null>(null);
  const [caraKeluarFocused, setCaraKeluarFocused] = React.useState(false);
  const caraKeluarRef = React.useRef<HTMLSelectElement>(null);
  const [keadaanFocused, setKeadaanFocused] = React.useState(false);
  const keadaanRef = React.useRef<HTMLSelectElement>(null);
  const formRef = React.useRef<HTMLDivElement>(null);

  const set = (key: keyof ResumeRanap, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  React.useEffect(() => {
    const fetchResume = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/resume/${patient.no_rawat}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.resume_pasien_ranap) {
          setForm({
            ...empty,
            ...data.resume_pasien_ranap,
            kd_dokter_pengirim: data.resume_pasien_ranap.kd_dokter_pengirim || patient.kd_dokter || '',
            nm_dokter_pengirim: data.resume_pasien_ranap.nm_dokter_pengirim || patient.nm_dokter || '',
          });
          setExists(true);
        } else {
          setForm({ ...empty, kd_dokter_pengirim: patient.kd_dokter || '', nm_dokter_pengirim: patient.nm_dokter || '' });
          setExists(false);
        }
      } catch {
        setForm({ ...empty, kd_dokter_pengirim: patient.kd_dokter || '', nm_dokter_pengirim: patient.nm_dokter || '' });
        setExists(false);
      } finally {
        setLoading(false);
      }
    };
    fetchResume();
  }, [patient.no_rawat]);

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
      setExists(true);
      Swal.fire({ icon: 'success', title: 'Resume berhasil disimpan', timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Hapus Resume?',
      text: 'Data resume yang sudah disimpan akan dihapus permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Batal',
      confirmButtonText: 'Ya, Hapus',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/resume-ranap?no_rawat=${encodeURIComponent(patient.no_rawat)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menghapus');
      setExists(false);
      setForm({ ...empty, kd_dokter_pengirim: patient.kd_dokter || '', nm_dokter_pengirim: patient.nm_dokter || '' });
      Swal.fire({ icon: 'success', title: 'Resume dihapus', timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
    }
  };

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
      Memuat data resume...
    </div>
  );

  return (
    <div style={{ maxWidth: 900 }} ref={formRef}>

      {/* Dokter */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>Dokter</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Dokter Pengirim — auto-fill dari reg_periksa */}
          <div>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
              Dokter IGD :
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={form.kd_dokter_pengirim} readOnly placeholder="Kode"
                style={{ width: '28%', padding: '8px 10px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#f9fafb', color: '#374151' }} />
              <input type="text" value={form.nm_dokter_pengirim} readOnly placeholder="Nama dokter pengirim"
                style={{ flex: 1, padding: '8px 10px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#f9fafb', color: '#374151' }} />
            </div>
          </div>
          {/* Dokter PJ */}
          <div>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: '#374151', fontWeight: 500 }}>
              DPJP :
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={form.kd_dokter}
                onChange={e => setForm(f => ({ ...f, kd_dokter: e.target.value }))}
                placeholder="Kode"
                style={{ width: '28%', padding: '8px 10px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
              <input type="text" value={form.nm_dokter} readOnly placeholder="Nama dokter"
                style={{ flex: 1, padding: '8px 10px', borderRadius: 12, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#f9fafb', color: '#374151' }} />
              <button type="button" onClick={() => setDokterOpen(true)}
                style={{ padding: '2px 2px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Pilih dokter PJ">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
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
            <div style={{ position: 'relative', border: `1px solid ${caraKeluarFocused ? '#2563eb' : '#d1d5db'}`, borderRadius: 8, background: '#fff', transition: 'border-color 0.15s' }}>
              <select
                ref={caraKeluarRef}
                value={form.cara_keluar}
                onChange={e => set('cara_keluar', e.target.value)}
                onFocus={() => setCaraKeluarFocused(true)}
                onBlur={() => setCaraKeluarFocused(false)}
                style={{ width: '100%', padding: '8px 36px 8px 10px', border: 'none', borderRadius: 8, fontSize: 13, outline: 'none', background: 'transparent', color: '#111827', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
              >
                <option value="">-- Pilih --</option>
                <option value="Sembuh">Sembuh</option>
                <option value="Rujuk">Rujuk</option>
                <option value="Pulang Paksa">Pulang Paksa</option>
                <option value="Meninggal">Meninggal</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 1, alignSelf: 'stretch', background: caraKeluarFocused ? '#2563eb' : '#d1d5db', transition: 'background 0.15s' }} />
                <div style={{ padding: '0 10px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={caraKeluarFocused ? '#2563eb' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.15s', display: 'block' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
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
            <div style={{ position: 'relative', border: `1px solid ${keadaanFocused ? '#2563eb' : '#d1d5db'}`, borderRadius: 8, background: '#fff', transition: 'border-color 0.15s' }}>
              <select
                ref={keadaanRef}
                value={form.keadaan}
                onChange={e => set('keadaan', e.target.value)}
                onFocus={() => setKeadaanFocused(true)}
                onBlur={() => setKeadaanFocused(false)}
                style={{ width: '100%', padding: '8px 36px 8px 10px', border: 'none', borderRadius: 8, fontSize: 13, outline: 'none', background: 'transparent', color: '#111827', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
              >
                <option value="">-- Pilih --</option>
                <option value="Baik">Baik</option>
                <option value="Sedang">Sedang</option>
                <option value="Buruk">Buruk</option>
              </select>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 1, alignSelf: 'stretch', background: keadaanFocused ? '#2563eb' : '#d1d5db', transition: 'background 0.15s' }} />
                <div style={{ padding: '0 10px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={keadaanFocused ? '#2563eb' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.15s', display: 'block' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
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

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 32px', borderRadius: 8, border: 'none',
            background: saving ? '#9ca3af' : '#10b981', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? 'Menyimpan...' : exists ? 'Update Resume' : 'Simpan Resume'}
        </button>
      </div>

      {/* Riwayat Resume */}
      {exists && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1AB1E5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Resume Tersimpan
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #1AB1E5', background: '#fff', color: '#1AB1E5', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Hapus
              </button>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

            {/* Dokter */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <RiwayatItem label="Dokter Pengirim" value={`${form.kd_dokter_pengirim ? `[${form.kd_dokter_pengirim}] ` : ''}${form.nm_dokter_pengirim}`} />
              <RiwayatItem label="Dokter PJ" value={`${form.kd_dokter ? `[${form.kd_dokter}] ` : ''}${form.nm_dokter}`} />
            </div>

            {/* Anamnesis */}
            {(form.diagnosa_awal || form.alasan || form.keluhan_utama) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {form.diagnosa_awal && <RiwayatItem label="Diagnosa Awal" value={form.diagnosa_awal} />}
                {form.alasan && <RiwayatItem label="Alasan Masuk RS" value={form.alasan} />}
                {form.keluhan_utama && <RiwayatItem label="Keluhan Utama" value={form.keluhan_utama} span2 />}
              </div>
            )}

            {/* Pemeriksaan */}
            {(form.pemeriksaan_fisik || form.pemeriksaan_penunjang || form.hasil_laborat || form.obat_di_rs) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {form.pemeriksaan_fisik && <RiwayatItem label="Pemeriksaan Fisik" value={form.pemeriksaan_fisik} />}
                {form.pemeriksaan_penunjang && <RiwayatItem label="Pemeriksaan Penunjang" value={form.pemeriksaan_penunjang} />}
                {form.hasil_laborat && <RiwayatItem label="Hasil Laboratorium" value={form.hasil_laborat} span2 />}
                {form.obat_di_rs && <RiwayatItem label="Obat di RS" value={form.obat_di_rs} span2 />}
              </div>
            )}

            {/* Diagnosa */}
            {[
              ['Diagnosa Utama', form.diagnosa_utama, form.kd_diagnosa_utama],
              ['Diagnosa Sekunder 1', form.diagnosa_sekunder, form.kd_diagnosa_sekunder],
              ['Diagnosa Sekunder 2', form.diagnosa_sekunder2, form.kd_diagnosa_sekunder2],
              ['Diagnosa Sekunder 3', form.diagnosa_sekunder3, form.kd_diagnosa_sekunder3],
              ['Diagnosa Sekunder 4', form.diagnosa_sekunder4, form.kd_diagnosa_sekunder4],
              ['Diagnosa Sekunder 5', form.diagnosa_sekunder5, form.kd_diagnosa_sekunder5],
            ].some(([, v]) => v) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Diagnosa</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Diagnosa Utama', form.diagnosa_utama, form.kd_diagnosa_utama],
                    ['Sekunder 1', form.diagnosa_sekunder, form.kd_diagnosa_sekunder],
                    ['Sekunder 2', form.diagnosa_sekunder2, form.kd_diagnosa_sekunder2],
                    ['Sekunder 3', form.diagnosa_sekunder3, form.kd_diagnosa_sekunder3],
                    ['Sekunder 4', form.diagnosa_sekunder4, form.kd_diagnosa_sekunder4],
                    ['Sekunder 5', form.diagnosa_sekunder5, form.kd_diagnosa_sekunder5],
                  ].filter(([, v]) => v).map(([label, nama, kode]) => (
                    <div key={label as string} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: '#6b7280', width: 120, flexShrink: 0, fontSize: 12 }}>{label as string}</span>
                      <span style={{ color: '#111827' }}>{nama as string}</span>
                      {kode && <span style={{ color: '#7c3aed', fontSize: 12, background: '#f5f3ff', padding: '1px 6px', borderRadius: 4 }}>{kode as string}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prosedur */}
            {[
              form.prosedur_utama, form.prosedur_sekunder, form.prosedur_sekunder2,
              form.prosedur_sekunder3, form.prosedur_sekunder4, form.prosedur_sekunder5,
            ].some(v => v) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Prosedur / Tindakan</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Prosedur Utama', form.prosedur_utama, form.kd_prosedur_utama],
                    ['Sekunder 1', form.prosedur_sekunder, form.kd_prosedur_sekunder],
                    ['Sekunder 2', form.prosedur_sekunder2, form.kd_prosedur_sekunder2],
                    ['Sekunder 3', form.prosedur_sekunder3, form.kd_prosedur_sekunder3],
                    ['Sekunder 4', form.prosedur_sekunder4, form.kd_prosedur_sekunder4],
                    ['Sekunder 5', form.prosedur_sekunder5, form.kd_prosedur_sekunder5],
                  ].filter(([, v]) => v).map(([label, nama, kode]) => (
                    <div key={label as string} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: '#6b7280', width: 120, flexShrink: 0, fontSize: 12 }}>{label as string}</span>
                      <span style={{ color: '#111827' }}>{nama as string}</span>
                      {kode && <span style={{ color: '#0891b2', fontSize: 12, background: '#e0f2fe', padding: '1px 6px', borderRadius: 4 }}>{kode as string}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Konsultasi, Edukasi, Kondisi Keluar */}
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {form.konsul_dokter && <RiwayatItem label="Konsultasi Dokter" value={form.konsul_dokter} />}
              {form.edukasi && <RiwayatItem label="Edukasi" value={form.edukasi} />}
              {form.cara_keluar && <RiwayatItem label="Cara Keluar" value={form.cara_keluar} />}
              {form.ket_keluar && <RiwayatItem label="Keterangan Keluar" value={form.ket_keluar} />}
              {form.keadaan && <RiwayatItem label="Keadaan Pulang" value={form.keadaan} />}
              {form.ket_keadaan && <RiwayatItem label="Keterangan Keadaan" value={form.ket_keadaan} />}
              {form.obat_pulang && <RiwayatItem label="Obat Pulang" value={form.obat_pulang} span2 />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RiwayatItem: React.FC<{ label: string; value: string; span2?: boolean }> = ({ label, value, span2 }) => (
  <div style={{ gridColumn: span2 ? 'span 2' : 'span 1' }}>
    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{value || '-'}</div>
  </div>
);
