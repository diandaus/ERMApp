import React from 'react';
import Swal from 'sweetalert2';

// AkunPeruri.tsx — "Data Pengguna" (Bridging > Peruri > Data Pengguna),
// CRUD tabel akun_peruri (backend/akun_peruri_handler.go). Tabel ini SUDAH
// ADA duluan di DB ibnusinadev (dicopy manual ke DB sik) — data pengguna
// yg didaftarkan/diverifikasi lewat proses Generate Certificate Peruri
// (nama/KTP/foto KTP/dst), dipakai sbg identitas penandatangan dokumen.

type AkunPeruriRow = {
  name: string; phone: string; email: string; type: string; ktp: string;
  address: string; city: string; province: string; gender: string;
  place_of_birth: string; date_of_birth: string; org_unit: string; work_unit: string;
  position: string; has_ktp_photo: boolean;
};

type AkunPeruriDetail = AkunPeruriRow & { ktp_photo: string };

type AkunPeruriForm = {
  name: string; phone: string; email: string; type: string; ktp: string; ktp_photo: string;
  address: string; city: string; province: string; gender: string;
  place_of_birth: string; date_of_birth: string; org_unit: string; work_unit: string; position: string;
};

const EMPTY_FORM: AkunPeruriForm = {
  name: '', phone: '', email: '', type: 'INDIVIDUAL', ktp: '', ktp_photo: '',
  address: '', city: '', province: '', gender: 'M',
  place_of_birth: '', date_of_birth: '', org_unit: '', work_unit: '', position: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
// selectStyle — dropdown native disembunyikan (appearance:none), panah
// bawaan browser diganti StepperIcon di bawah — persis pola dropdown
// Dokter/Poli/Status di PermintaanResep.tsx & ModalTelaahResep.tsx.
const selectStyle: React.CSSProperties = {
  ...inputStyle, paddingRight: 30, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', background: '#fff',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#6b7280', marginBottom: 4 };

// StepperIcon — ikon panah bulat hijau pengganti panah dropdown native,
// sama pola dgn ModalTelaahResep.tsx TAPI borderRadius 2 (bukan '30%').
const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 18, height: 18, borderRadius: 2, background: '#059669',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const SelectField: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ label, value, onChange, options }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <StepperIcon />
    </div>
  </div>
);

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

// fileToBase64 — baca file jadi base64 TANPA prefix "data:...;base64,"
// (kolom ktp_photo di DB nyimpan base64 mentah, dikonfirmasi dari data yg
// sudah ada di tabel akun_peruri).
const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    resolve(result.split(',')[1] || '');
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const AkunPeruriFormModal: React.FC<{
  editing: AkunPeruriRow | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ editing, onClose, onSaved }) => {
  const [form, setForm] = React.useState<AkunPeruriForm>(EMPTY_FORM);
  const [loading, setLoading] = React.useState(!!editing);
  const [saving, setSaving] = React.useState(false);
  const [ktpPhotoPreview, setKtpPhotoPreview] = React.useState('');

  React.useEffect(() => {
    if (!editing) {
      setForm(EMPTY_FORM);
      setKtpPhotoPreview('');
      return;
    }
    setLoading(true);
    fetch(`/api/akun-peruri/${encodeURIComponent(editing.email)}`)
      .then((r) => r.json())
      .then((data: AkunPeruriDetail) => {
        setForm({ ...data, ktp_photo: '' }); // ktp_photo form dikosongkan — cuma diisi kalau user upload foto BARU (lihat komentar updateAkunPeruri backend)
        if (data.ktp_photo) setKtpPhotoPreview(`data:image/jpeg;base64,${data.ktp_photo}`);
      })
      .catch(() => Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat detail akun' }))
      .finally(() => setLoading(false));
  }, [editing]);

  const set = <K extends keyof AkunPeruriForm>(key: K, val: AkunPeruriForm[K]) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    set('ktp_photo', base64);
    setKtpPhotoPreview(URL.createObjectURL(file));
  };

  const handleSimpan = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.ktp.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Nama, No. HP, Email, dan No. KTP wajib diisi' });
      return;
    }
    if (!editing && !form.ktp_photo) {
      Swal.fire({ icon: 'warning', title: 'Foto KTP wajib diupload' });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/akun-peruri/${encodeURIComponent(editing.email)}` : '/api/akun-peruri';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Data pengguna Peruri tersimpan', timer: 1800, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 720, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
          {editing ? 'Edit Data Pengguna' : 'Tambah Data Pengguna'}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 120, textAlign: 'center' }}>
                <div style={{ width: 120, height: 90, borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 }}>
                  {ktpPhotoPreview ? (
                    <img src={ktpPhotoPreview} alt="Foto KTP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 10.5, color: '#9ca3af' }}>Belum ada foto</span>
                  )}
                </div>
                <label style={{ fontSize: 11, color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}>
                  Upload Foto KTP
                  <input type="file" accept="image/*" onChange={handleFotoChange} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Nama Lengkap"><input value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="No. KTP"><input value={form.ktp} onChange={(e) => set('ktp', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="No. HP"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="Email">
                  <input value={form.email} onChange={(e) => set('email', e.target.value)} style={inputStyle} disabled={!!editing} />
                </FormField>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <SelectField
                label="Jenis Kelamin" value={form.gender} onChange={(v) => set('gender', v)}
                options={[{ value: 'M', label: 'Laki-laki' }, { value: 'F', label: 'Perempuan' }]}
              />
              <FormField label="Tempat Lahir"><input value={form.place_of_birth} onChange={(e) => set('place_of_birth', e.target.value)} style={inputStyle} /></FormField>
              <FormField label="Tanggal Lahir"><input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} style={inputStyle} /></FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Alamat"><input value={form.address} onChange={(e) => set('address', e.target.value)} style={inputStyle} /></FormField>
              <FormField label="Kota"><input value={form.city} onChange={(e) => set('city', e.target.value)} style={inputStyle} /></FormField>
              <FormField label="Provinsi"><input value={form.province} onChange={(e) => set('province', e.target.value)} style={inputStyle} /></FormField>
              <SelectField
                label="Tipe Akun" value={form.type} onChange={(v) => set('type', v)}
                options={[{ value: 'INDIVIDUAL', label: 'INDIVIDUAL' }, { value: 'User', label: 'User' }]}
              />
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>Unit Kerja</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <FormField label="Unit Organisasi"><input value={form.org_unit} onChange={(e) => set('org_unit', e.target.value)} style={inputStyle} /></FormField>
              <FormField label="Unit Kerja"><input value={form.work_unit} onChange={(e) => set('work_unit', e.target.value)} style={inputStyle} /></FormField>
              <FormField label="Jabatan"><input value={form.position} onChange={(e) => set('position', e.target.value)} style={inputStyle} /></FormField>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
          <button
            type="button" onClick={handleSimpan} disabled={saving || loading}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: (saving || loading) ? '#9ca3af' : '#059669', color: '#fff', cursor: (saving || loading) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AkunPeruriView: React.FC = () => {
  const [list, setList] = React.useState<AkunPeruriRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<AkunPeruriRow | null>(null);

  const fetchList = React.useCallback((q: string) => {
    setLoading(true);
    fetch(`/api/akun-peruri?search=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(search), 250);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  // handleSertifikat — tombol "Sertifikat", cek status sertifikat digital
  // penandatangan ini di Peruri (API Check Certificate By Email, grup
  // "Generate Certificate" di Pengaturan). Tampilkan raw response krn
  // skema field status sertifikatnya belum dikonfirmasi.
  const handleSertifikat = async (row: AkunPeruriRow) => {
    Swal.fire({ title: 'Memeriksa sertifikat...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const res = await fetch('/api/peruri/check-certificate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: row.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memeriksa sertifikat');
      Swal.fire({
        icon: 'info', title: `Status Sertifikat — ${row.name}`,
        html: `<pre style="text-align:left;font-size:11.5px;white-space:pre-wrap;word-break:break-all;">${JSON.stringify(data.response, null, 2)}</pre>`,
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  const handleHapus = async (row: AkunPeruriRow) => {
    const confirm = await Swal.fire({
      icon: 'warning', title: 'Hapus akun ini?', text: `${row.name} (${row.email})`,
      showCancelButton: true, confirmButtonText: 'Hapus', confirmButtonColor: '#dc2626', cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/akun-peruri/${encodeURIComponent(row.email)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      Swal.fire({ icon: 'success', title: 'Terhapus', timer: 1200, showConfirmButton: false });
      fetchList(search);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama / email / No. HP / No. KTP..."
          style={{ ...inputStyle, maxWidth: 320 }}
        />
        <button
          type="button" onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          + Tambah Pengguna
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nama</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>No. HP</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Unit Kerja</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tipe</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>Belum ada data pengguna</td></tr>
            ) : (
              list.map((row, i) => (
                <tr key={row.email} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '8px 12px' }}>{row.name}</td>
                  <td style={{ padding: '8px 12px' }}>{row.email}</td>
                  <td style={{ padding: '8px 12px' }}>{row.phone}</td>
                  <td style={{ padding: '8px 12px' }}>{row.work_unit || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{row.type}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button
                      type="button" onClick={() => handleSertifikat(row)}
                      style={{ background: '#059669', border: 'none', borderRadius: 2, color: '#ffffff', cursor: 'pointer', fontSize: 11.5, fontWeight: 500, padding: '5px 10px', marginRight: 10 }}
                    >
                      Sertifikat
                    </button>
                    <button type="button" onClick={() => { setEditing(row); setShowForm(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: 11.5, fontWeight: 500, marginRight: 10 }}>Edit</button>
                    <button type="button" onClick={() => handleHapus(row)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 11.5, fontWeight: 500 }}>Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <AkunPeruriFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => fetchList(search)}
        />
      )}
    </div>
  );
};
