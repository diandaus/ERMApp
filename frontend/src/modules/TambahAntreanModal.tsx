import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

// TambahAntreanModal — form "Tambah Antrean" BPJS (POST antrean/add), diekstrak
// dari AntreanRs.tsx supaya bisa dipakai ulang dari tempat lain (Registrasi >
// [BPJS] > Tambah Antrean, dipakai staf utk kunjungan yg antrean otomatisnya
// gagal/belum sempat dibuat). Prop `initial` mengisi form di awal — kosongkan
// (atau tidak diberikan) utk perilaku sama seperti AntreanRs.tsx (form kosong).

export type AntreanFormState = {
  kodebooking: string;
  no_rawat: string;
  jenispasien: 'JKN' | 'NON JKN';
  nomorkartu: string;
  nik: string;
  nohp: string;
  kodepoli: string;
  namapoli: string;
  pasienbaru: boolean;
  norm: string;
  tanggalperiksa: string;
  kodedokter: string;
  namadokter: string;
  jampraktek: string;
  jeniskunjungan: number;
  nomorreferensi: string;
  nomorantrean: string;
  angkaantrean: string;
  estimasidilayani: string; // datetime-local value
  sisakuotajkn: string;
  kuotajkn: string;
  sisakuotanonjkn: string;
  kuotanonjkn: string;
  keterangan: string;
};

export const emptyAntreanForm = (): AntreanFormState => ({
  kodebooking: '',
  no_rawat: '',
  jenispasien: 'JKN',
  nomorkartu: '',
  nik: '',
  nohp: '',
  kodepoli: '',
  namapoli: '',
  pasienbaru: false,
  norm: '',
  tanggalperiksa: localDateStr(),
  kodedokter: '',
  namadokter: '',
  jampraktek: '',
  jeniskunjungan: 1,
  nomorreferensi: '',
  nomorantrean: '',
  angkaantrean: '',
  estimasidilayani: '',
  sisakuotajkn: '',
  kuotajkn: '',
  sisakuotanonjkn: '',
  kuotanonjkn: '',
  keterangan: '',
});

const jenisKunjunganLabel: Record<number, string> = {
  1: 'Rujukan FKTP',
  2: 'Rujukan Internal',
  3: 'Kontrol',
  4: 'Rujukan Antar RS',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
  display: 'block',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

export const epochMsToDatetimeLocal = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const TambahAntreanModal: React.FC<{
  title?: string;
  initial?: Partial<AntreanFormState>;
  warning?: string;
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ title, initial, warning, onClose, onSuccess }) => {
  const [form, setForm] = React.useState<AntreanFormState>({ ...emptyAntreanForm(), ...initial });
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const estimasiMs = form.estimasidilayani ? new Date(form.estimasidilayani).getTime() : 0;
      const body = {
        kodebooking: form.kodebooking.trim(),
        no_rawat: form.no_rawat.trim(),
        jenispasien: form.jenispasien,
        nomorkartu: form.jenispasien === 'JKN' ? form.nomorkartu.trim() : '',
        nik: form.nik.trim(),
        nohp: form.nohp.trim(),
        kodepoli: form.kodepoli.trim(),
        namapoli: form.namapoli.trim(),
        pasienbaru: form.pasienbaru ? 1 : 0,
        norm: form.norm.trim(),
        tanggalperiksa: form.tanggalperiksa,
        kodedokter: form.kodedokter.trim(),
        namadokter: form.namadokter.trim(),
        jampraktek: form.jampraktek.trim(),
        jeniskunjungan: form.jeniskunjungan,
        nomorreferensi: form.jenispasien === 'JKN' ? form.nomorreferensi.trim() : '',
        nomorantrean: form.nomorantrean.trim(),
        angkaantrean: Number(form.angkaantrean) || 0,
        estimasidilayani: estimasiMs,
        sisakuotajkn: Number(form.sisakuotajkn) || 0,
        kuotajkn: Number(form.kuotajkn) || 0,
        sisakuotanonjkn: Number(form.sisakuotanonjkn) || 0,
        kuotanonjkn: Number(form.kuotanonjkn) || 0,
        keterangan: form.keterangan.trim(),
      };
      const res = await fetch('/api/bridging/antrean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah antrean');
      onClose();
      onSuccess?.();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Antrean berhasil ditambahkan', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 720, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>{title || 'Tambah Antrean'}</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {warning && (
            <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 11, background: '#fefce8', border: '1px solid #fde68a', color: '#854d0e' }}>
              {warning} — mohon cek/lengkapi manual sebelum dikirim.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Kode Booking *">
              <input required style={inputStyle} value={form.kodebooking} onChange={(e) => setForm((p) => ({ ...p, kodebooking: e.target.value }))} placeholder="Isi manual, unik per antrean" />
            </Field>
            <Field label="Jenis Pasien">
              <select style={inputStyle} value={form.jenispasien} onChange={(e) => setForm((p) => ({ ...p, jenispasien: e.target.value as 'JKN' | 'NON JKN' }))}>
                <option value="JKN">JKN</option>
                <option value="NON JKN">NON JKN</option>
              </select>
            </Field>
            {form.jenispasien === 'JKN' && (
              <Field label="No. Kartu BPJS">
                <input style={inputStyle} value={form.nomorkartu} onChange={(e) => setForm((p) => ({ ...p, nomorkartu: e.target.value }))} />
              </Field>
            )}
            <Field label="NIK">
              <input style={inputStyle} value={form.nik} onChange={(e) => setForm((p) => ({ ...p, nik: e.target.value }))} />
            </Field>
            <Field label="No. HP">
              <input style={inputStyle} value={form.nohp} onChange={(e) => setForm((p) => ({ ...p, nohp: e.target.value }))} />
            </Field>
            <Field label="No. RM *">
              <input required style={inputStyle} value={form.norm} onChange={(e) => setForm((p) => ({ ...p, norm: e.target.value }))} />
            </Field>
            <Field label="Kode Poli *">
              <input required style={inputStyle} value={form.kodepoli} onChange={(e) => setForm((p) => ({ ...p, kodepoli: e.target.value.toUpperCase() }))} placeholder="ANA" />
            </Field>
            <Field label="Nama Poli">
              <input style={inputStyle} value={form.namapoli} onChange={(e) => setForm((p) => ({ ...p, namapoli: e.target.value }))} />
            </Field>
            <Field label="Tanggal Periksa *">
              <input required type="date" style={inputStyle} value={form.tanggalperiksa} onChange={(e) => setForm((p) => ({ ...p, tanggalperiksa: e.target.value }))} />
            </Field>
            <Field label="Pasien Baru">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, height: 36 }}>
                <input type="checkbox" checked={form.pasienbaru} onChange={(e) => setForm((p) => ({ ...p, pasienbaru: e.target.checked }))} />
                Ya, pasien baru
              </label>
            </Field>
            <Field label="Kode Dokter *">
              <input required style={inputStyle} value={form.kodedokter} onChange={(e) => setForm((p) => ({ ...p, kodedokter: e.target.value }))} placeholder="12345" />
            </Field>
            <Field label="Nama Dokter">
              <input style={inputStyle} value={form.namadokter} onChange={(e) => setForm((p) => ({ ...p, namadokter: e.target.value }))} />
            </Field>
            <Field label="Jam Praktek">
              <input style={inputStyle} value={form.jampraktek} onChange={(e) => setForm((p) => ({ ...p, jampraktek: e.target.value }))} placeholder="08:00-16:00" />
            </Field>
            <Field label="Jenis Kunjungan">
              <select style={inputStyle} value={form.jeniskunjungan} onChange={(e) => setForm((p) => ({ ...p, jeniskunjungan: Number(e.target.value) }))}>
                {Object.entries(jenisKunjunganLabel).map(([v, label]) => (
                  <option key={v} value={v}>{v} - {label}</option>
                ))}
              </select>
            </Field>
            {form.jenispasien === 'JKN' && (
              <Field label="No. Rujukan/Kontrol">
                <input style={inputStyle} value={form.nomorreferensi} onChange={(e) => setForm((p) => ({ ...p, nomorreferensi: e.target.value }))} />
              </Field>
            )}
            <Field label="No. Antrean">
              <input style={inputStyle} value={form.nomorantrean} onChange={(e) => setForm((p) => ({ ...p, nomorantrean: e.target.value }))} placeholder="A-12" />
            </Field>
            <Field label="Angka Antrean">
              <input type="number" style={inputStyle} value={form.angkaantrean} onChange={(e) => setForm((p) => ({ ...p, angkaantrean: e.target.value }))} />
            </Field>
            <Field label="Estimasi Dilayani">
              <input type="datetime-local" style={inputStyle} value={form.estimasidilayani} onChange={(e) => setForm((p) => ({ ...p, estimasidilayani: e.target.value }))} />
            </Field>
            <Field label="Sisa Kuota JKN">
              <input type="number" style={inputStyle} value={form.sisakuotajkn} onChange={(e) => setForm((p) => ({ ...p, sisakuotajkn: e.target.value }))} />
            </Field>
            <Field label="Kuota JKN">
              <input type="number" style={inputStyle} value={form.kuotajkn} onChange={(e) => setForm((p) => ({ ...p, kuotajkn: e.target.value }))} />
            </Field>
            <Field label="Sisa Kuota Non JKN">
              <input type="number" style={inputStyle} value={form.sisakuotanonjkn} onChange={(e) => setForm((p) => ({ ...p, sisakuotanonjkn: e.target.value }))} />
            </Field>
            <Field label="Kuota Non JKN">
              <input type="number" style={inputStyle} value={form.kuotanonjkn} onChange={(e) => setForm((p) => ({ ...p, kuotanonjkn: e.target.value }))} />
            </Field>
          </div>
          <Field label="Keterangan">
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} placeholder="Informasi untuk pasien" />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              {saving ? 'Mengirim...' : 'Kirim ke BPJS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
