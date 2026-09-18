import React from 'react';
import Swal from 'sweetalert2';
import { mediaUrl } from '../utils/apiBase';

type PegawaiForm = {
  nik: string; nama: string; jk: string; jbtn: string;
  jnj_jabatan: string; kode_kelompok: string; kode_resiko: string; kode_emergency: string;
  departemen: string; bidang: string; stts_wp: string; stts_kerja: string;
  npwp: string; pendidikan: string; tmp_lahir: string; tgl_lahir: string;
  alamat: string; kota: string; mulai_kerja: string; ms_kerja: string;
  indexins: string; bpd: string; rekening: string; stts_aktif: string;
  wajibmasuk: number; mulai_kontrak: string; no_ktp: string; email: string;
  photo: string;
};

// pegawai.photo sering berisi path legacy Khanza desktop (mis.
// "pages/pegawai/photo/xxx.jpg") yang tidak bisa diakses backend web ini —
// hanya dipakai kalau sudah berupa URL yang valid (/uploads/... hasil
// upload baru, atau http/https), selain itu tampilkan placeholder kosong.
// Sama pola dgn isUsablePhotoUrl di App.tsx/PresensiMobile.tsx.
function isUsablePhotoUrl(photo: string): boolean {
  return photo.startsWith('/uploads/') || photo.startsWith('http://') || photo.startsWith('https://');
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: PegawaiForm;
}

type MasterItem = { kode: string; nama: string };
type MasterIndexins = { kode: string; persen: string };
type Master = {
  departemen: MasterItem[];
  bidang: string[];
  pendidikan: string[];
  jnj_jabatan: MasterItem[];
  kelompok_jabatan: MasterItem[];
  resiko_kerja: MasterItem[];
  emergency_index: MasterItem[];
  stts_wp: MasterItem[];
  stts_kerja: MasterItem[];
  indexins: MasterIndexins[];
  bank: string[];
};

const EMPTY_MASTER: Master = {
  departemen: [], bidang: [], pendidikan: [], jnj_jabatan: [],
  kelompok_jabatan: [], resiko_kerja: [], emergency_index: [],
  stts_wp: [], stts_kerja: [], indexins: [], bank: [],
};

const INIT: PegawaiForm = {
  nik: '', nama: '', jk: 'Pria', jbtn: '',
  jnj_jabatan: '-', kode_kelompok: '-', kode_resiko: '-', kode_emergency: '-',
  departemen: '-', bidang: '-', stts_wp: '-', stts_kerja: '-',
  npwp: '', pendidikan: '-', tmp_lahir: '', tgl_lahir: '',
  alamat: '', kota: '', mulai_kerja: '', ms_kerja: '<1',
  indexins: '-', bpd: '-', rekening: '', stts_aktif: 'AKTIF',
  wajibmasuk: 0, mulai_kontrak: '', no_ktp: '', email: '', photo: '',
};

const iStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...iStyle, paddingRight: 30, appearance: 'none', WebkitAppearance: 'none',
  cursor: 'pointer', background: '#ffffff',
};

const lStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, marginBottom: 3, color: '#374151', fontWeight: 500,
};

const F: React.FC<{ label: string; req?: boolean; children: React.ReactNode; hint?: string }> = ({ label, req, children, hint }) => (
  <div>
    <label style={lStyle}>{label}{req && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}</label>
    {children}
    {hint && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{hint}</div>}
  </div>
);

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 22, height: 22, borderRadius: '50%', background: '#4338ca',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const Sel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'relative' }}>
    {children}
    <StepperIcon />
  </div>
);

const SelectKN: React.FC<{ value: string; onChange: (v: string) => void; items: MasterItem[]; empty?: boolean }> = ({ value, onChange, items, empty }) => (
  <Sel>
    <select style={selectStyle} value={value} onChange={e => onChange(e.target.value)}>
      {empty && <option value="">-- Pilih --</option>}
      {items.map(it => (
        <option key={it.kode} value={it.kode}>{it.kode !== '-' ? `${it.kode} — ${it.nama}` : '-'}</option>
      ))}
    </select>
  </Sel>
);

export const ModalTambahPegawai: React.FC<Props> = ({ isOpen, onClose, onSuccess, editData }) => {
  const isEdit = !!editData;
  const [form, setForm]     = React.useState<PegawaiForm>({ ...INIT });
  const [saving, setSaving] = React.useState(false);
  const [error, setError]   = React.useState<string | null>(null);
  const [master, setMaster] = React.useState<Master>(EMPTY_MASTER);
  const [uploadingFoto, setUploadingFoto] = React.useState(false);
  const fotoInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch('/api/pegawai/master').then(r => r.json()).then(d => setMaster(d)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setForm(editData ? { ...editData } : { ...INIT });
      setError(null);
    }
  }, [isOpen, editData]);

  const set = (k: keyof PegawaiForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: k === 'wajibmasuk' ? parseInt(e.target.value) || 0 : e.target.value }));

  // Upload foto pegawai — pakai endpoint generik /api/upload yg sudah ada
  // (sama pola dgn foto profil self-service di PresensiMobile.tsx),
  // hasilnya (URL /uploads/...) cuma disimpan di form.photo dulu, baru
  // ikut terkirim ke backend saat "Simpan" (Tambah/Edit) diklik —
  // sengaja TIDAK langsung PUT ke pegawai di sini krn utk "Tambah Pegawai
  // Baru" baris pegawainya belum ada sama sekali sampai form ini disubmit.
  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah foto');
      setForm(prev => ({ ...prev, photo: data.url }));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan', confirmButtonColor: '#2563eb' });
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama || !form.jk) { setError('Nama dan Jenis Kelamin wajib diisi'); return; }
    if (!isEdit && !form.nik)   { setError('NIK wajib diisi'); return; }
    setSaving(true); setError(null);
    try {
      const url    = isEdit ? `/api/pegawai/${encodeURIComponent(form.nik)}` : '/api/pegawai';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: `${isEdit ? 'Data' : 'Pegawai'} ${form.nama} berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}`, confirmButtonColor: '#2563eb', timer: 1800, showConfirmButton: false });
      onSuccess(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#f9fafb', borderRadius: 16, padding: '40px 8px 8px', position: 'relative',
          width: '95%', maxWidth: 900, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            {isEdit ? 'Edit Data Pegawai' : 'Tambah Pegawai Baru'}
          </span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ── Section: Identitas ───────────────────────────────────────── */}
            <SectionTitle>Data Identitas</SectionTitle>

            {/* Foto profil — upload lewat /api/upload, URL-nya disimpan di
                form.photo (ikut terkirim saat Simpan). Preview pakai foto
                yg sudah ada (isEdit) atau yg baru diunggah. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #e5e7eb',
              }}>
                {form.photo && isUsablePhotoUrl(form.photo) ? (
                  <img src={mediaUrl(form.photo)} alt={form.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#2563eb" />
                    <path d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z" fill="#2563eb" />
                  </svg>
                )}
              </div>
              <div>
                <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={uploadingFoto}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db',
                    background: '#fff', color: '#374151', fontSize: 12, fontWeight: 500,
                    cursor: uploadingFoto ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploadingFoto ? 'Mengunggah...' : (form.photo ? 'Ganti Foto' : 'Upload Foto')}
                </button>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>JPG/PNG, opsional</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px', marginBottom: 16 }}>
              <F label="NIP / NIK Pegawai" req={!isEdit}>
                <input style={{ ...iStyle, background: isEdit ? '#f3f4f6' : '#fff', color: isEdit ? '#6b7280' : '#111' }}
                  value={form.nik} onChange={set('nik')} placeholder="Nomor Induk Pegawai" maxLength={20} readOnly={isEdit} />
              </F>
              <F label="Nama Lengkap" req>
                <input style={iStyle} value={form.nama} onChange={set('nama')} placeholder="Nama pegawai" maxLength={50} />
              </F>
              <F label="Jenis Kelamin" req>
                <Sel>
                  <select style={selectStyle} value={form.jk} onChange={set('jk')}>
                    <option value="Pria">Pria</option>
                    <option value="Wanita">Wanita</option>
                  </select>
                </Sel>
              </F>
              <F label="No KTP">
                <input style={iStyle} value={form.no_ktp} onChange={set('no_ktp')} placeholder="16 digit NIK KTP" maxLength={20} />
              </F>
              <F label="NPWP">
                <input style={iStyle} value={form.npwp} onChange={set('npwp')} placeholder="Nomor NPWP" maxLength={15} />
              </F>
              <F label="Email">
                <input type="text" style={iStyle} value={form.email} onChange={set('email')} placeholder="email@contoh.com (opsional)" maxLength={255} />
              </F>
              <F label="Tempat Lahir">
                <input style={iStyle} value={form.tmp_lahir} onChange={set('tmp_lahir')} placeholder="Kota kelahiran" maxLength={20} />
              </F>
              <F label="Tanggal Lahir">
                <input type="date" style={iStyle} value={form.tgl_lahir} onChange={set('tgl_lahir')} />
              </F>
              <F label="Kota Domisili">
                <input style={iStyle} value={form.kota} onChange={set('kota')} placeholder="Kota domisili" maxLength={20} />
              </F>
              <F label="Alamat" >
                <input style={iStyle} value={form.alamat} onChange={set('alamat')} placeholder="Alamat lengkap" maxLength={60} />
              </F>
            </div>

            {/* ── Section: Kepegawaian ─────────────────────────────────────── */}
            <SectionTitle>Data Kepegawaian</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px', marginBottom: 16 }}>
              <F label="Jabatan">
                <input style={iStyle} value={form.jbtn} onChange={set('jbtn')} placeholder="Contoh: Perawat, Dokter Umum" maxLength={25} />
              </F>
              <F label="Jenjang Jabatan">
                <SelectKN value={form.jnj_jabatan} onChange={v => setForm(p => ({ ...p, jnj_jabatan: v }))} items={master.jnj_jabatan} />
              </F>
              <F label="Kelompok Jabatan">
                <SelectKN value={form.kode_kelompok} onChange={v => setForm(p => ({ ...p, kode_kelompok: v }))} items={master.kelompok_jabatan} />
              </F>
              <F label="Departemen">
                <SelectKN value={form.departemen} onChange={v => setForm(p => ({ ...p, departemen: v }))} items={master.departemen} />
              </F>
              <F label="Bagian (Bidang)">
                <Sel>
                  <select style={selectStyle} value={form.bidang} onChange={set('bidang')}>
                    {master.bidang.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Sel>
              </F>
              <F label="Pendidikan">
                <Sel>
                  <select style={selectStyle} value={form.pendidikan} onChange={set('pendidikan')}>
                    {master.pendidikan.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Sel>
              </F>
              <F label="Resiko Kerja">
                <SelectKN value={form.kode_resiko} onChange={v => setForm(p => ({ ...p, kode_resiko: v }))} items={master.resiko_kerja} />
              </F>
              <F label="Tingkat Emergency">
                <SelectKN value={form.kode_emergency} onChange={v => setForm(p => ({ ...p, kode_emergency: v }))} items={master.emergency_index} />
              </F>
              <F label="Status WP (Pajak)">
                <SelectKN value={form.stts_wp} onChange={v => setForm(p => ({ ...p, stts_wp: v }))} items={master.stts_wp} />
              </F>
              <F label="Status Kerja">
                <SelectKN value={form.stts_kerja} onChange={v => setForm(p => ({ ...p, stts_kerja: v }))} items={master.stts_kerja} />
              </F>
              <F label="Status Aktif">
                <Sel>
                  <select style={selectStyle} value={form.stts_aktif} onChange={set('stts_aktif')}>
                    <option value="AKTIF">AKTIF</option>
                    <option value="CUTI">CUTI</option>
                    <option value="KELUAR">KELUAR</option>
                    <option value="TENAGA LUAR">TENAGA LUAR</option>
                  </select>
                </Sel>
              </F>
            </div>

            {/* ── Section: Keuangan & Waktu ────────────────────────────────── */}
            <SectionTitle>Keuangan & Waktu Kerja</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px', marginBottom: 20 }}>
              <F label="Mulai Kerja">
                <input type="date" style={iStyle} value={form.mulai_kerja} onChange={set('mulai_kerja')} />
              </F>
              <F label="Mulai Kontrak">
                <input type="date" style={iStyle} value={form.mulai_kontrak} onChange={set('mulai_kontrak')} />
              </F>
              <F label="Ms Kerja">
                <Sel>
                  <select style={selectStyle} value={form.ms_kerja} onChange={set('ms_kerja')}>
                    <option value="<1">&lt;1 tahun</option>
                    <option value="PT">Part Time (PT)</option>
                    <option value="FT>1">Full Time &gt;1 (FT&gt;1)</option>
                  </select>
                </Sel>
              </F>
              <F label="Kode Index (Indexins)">
                <Sel>
                  <select style={selectStyle} value={form.indexins} onChange={set('indexins')}>
                    {master.indexins.map(it => (
                      <option key={it.kode} value={it.kode}>{it.kode !== '-' ? `${it.kode} — ${it.persen}%` : '-'}</option>
                    ))}
                  </select>
                </Sel>
              </F>
              <F label="Bank (BPD)">
                <Sel>
                  <select style={selectStyle} value={form.bpd} onChange={set('bpd')}>
                    <option value="-">-- Pilih Bank --</option>
                    {master.bank.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Sel>
              </F>
              <F label="No Rekening">
                <input style={iStyle} value={form.rekening} onChange={set('rekening')} placeholder="Nomor rekening" maxLength={25} />
              </F>
              <F label="Wajib Masuk"
                hint="0=normal, -1=kosong, -2=1bln-4hari, -3=1bln-2hari-linas, -4=1bln-akhad, -5=jadwal">
                <input type="number" style={iStyle} value={form.wajibmasuk} onChange={set('wajibmasuk')} min={-5} max={31} />
              </F>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                Batal
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #dbeafe' }}>
    {children}
  </div>
);
