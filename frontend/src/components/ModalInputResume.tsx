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

type ModalInputResumeProps = {
  patient: any;
  initialData: ResumeRanap;
  exists: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalInputResume: React.FC<ModalInputResumeProps> = ({ patient, initialData, exists, onClose, onSaved }) => {
  const [form, setForm] = React.useState<ResumeRanap>(initialData);
  const [saving, setSaving] = React.useState(false);
  const [dokterOpen, setDokterOpen] = React.useState(false);
  const [refField, setRefField] = React.useState<string | null>(null);
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
      {/* Overlay */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}
        onClick={onClose}
      >
        {/* Modal Container */}
        <div
          style={{
            background: '#F3F4F6', borderRadius: 20,
            padding: '35px 8px 8px 8px', position: 'relative',
            maxWidth: 1000, width: '90%', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>
              {exists ? 'Edit Resume Pasien Pulang' : 'Input Resume Pasien Pulang'}
            </span>
            <button
              type="button" onClick={onClose}
              style={{
                background: 'transparent', border: 'none',
                fontSize: 20, cursor: 'pointer', color: '#6b7280',
                padding: 0, lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* White Card Content */}
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0 }}>

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

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#dc2626', color: '#fff', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
              }}>Tutup</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: saving ? '#9ca3af' : '#2563eb', color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500,
                }}
              >{saving ? 'Menyimpan...' : exists ? 'Update Resume' : 'Simpan Resume'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
