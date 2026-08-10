import React from 'react';
import Swal from 'sweetalert2';
import { ModalCariPegawai } from './ModalCariPegawai';

type DokterForm = {
  kd_dokter: string; nm_dokter: string; jk: string; tmp_lahir: string; tgl_lahir: string;
  gol_drh: string; agama: string; almt_tgl: string; no_telp: string; email: string;
  stts_nikah: string; kd_sps: string; alumni: string; no_ijn_praktek: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: DokterForm;
}

type SpesialisOpsi = { kd_sps: string; nm_sps: string };

const INIT: DokterForm = {
  kd_dokter: '', nm_dokter: '', jk: 'L', tmp_lahir: '', tgl_lahir: '',
  gol_drh: 'A', agama: 'ISLAM', almt_tgl: '', no_telp: '', email: '',
  stts_nikah: 'BELUM MENIKAH', kd_sps: '', alumni: '', no_ijn_praktek: '',
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

const F: React.FC<{ label: string; req?: boolean; children: React.ReactNode }> = ({ label, req, children }) => (
  <div>
    <label style={lStyle}>{label}{req && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}</label>
    {children}
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

export const ModalTambahDokter: React.FC<Props> = ({ isOpen, onClose, onSuccess, editData }) => {
  const isEdit = !!editData;
  const [form, setForm] = React.useState<DokterForm>({ ...INIT });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [spesialisList, setSpesialisList] = React.useState<SpesialisOpsi[]>([]);
  const [showCariPegawai, setShowCariPegawai] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/spesialis/opsi').then(r => r.json()).then(d => setSpesialisList(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setForm(editData ? { ...editData } : { ...INIT });
      setError(null);
    }
  }, [isOpen, editData]);

  const set = (k: keyof DokterForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  // Dokter dipilih dari data pegawai yang sudah ada (dokter.kd_dokter
  // adalah FK ke pegawai.nik) — setelah pilih, ambil detail lengkap
  // (jk/tempat lahir/tgl lahir/alamat) lewat /api/pegawai/list supaya
  // tidak perlu diketik ulang manual.
  const handlePilihPegawai = async (nik: string, nama: string) => {
    setForm(prev => ({ ...prev, kd_dokter: nik, nm_dokter: nama }));
    try {
      const res = await fetch(`/api/pegawai/list?search=${encodeURIComponent(nik)}`);
      const data = await res.json();
      const match = Array.isArray(data) ? data.find((p: any) => p.nik === nik) : null;
      if (match) {
        setForm(prev => ({
          ...prev,
          kd_dokter: match.nik,
          nm_dokter: match.nama,
          jk: match.jk === 'Wanita' ? 'P' : 'L',
          tmp_lahir: match.tmp_lahir || '',
          tgl_lahir: match.tgl_lahir || '',
          almt_tgl: match.alamat || '',
          email: match.email || prev.email,
        }));
      }
    } catch {
      // Best-effort — field lain tetap bisa diisi manual kalau gagal.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kd_dokter) { setError('Kode Dokter wajib diisi (pilih dari data Pegawai)'); return; }
    if (!form.nm_dokter) { setError('Nama wajib diisi'); return; }
    if (!form.kd_sps) { setError('Spesialis wajib dipilih'); return; }
    setSaving(true); setError(null);
    try {
      const url = isEdit ? `/api/dokter/${encodeURIComponent(form.kd_dokter)}` : '/api/dokter';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: `Dokter ${form.nm_dokter} berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}`, confirmButtonColor: '#4338ca', timer: 1800, showConfirmButton: false });
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
          width: '95%', maxWidth: 720, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            {isEdit ? 'Edit Data Dokter' : 'Tambah Dokter Baru'}
          </span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 16 }}>
              <F label="Kode Dokter (dari data Pegawai)" req>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...iStyle, background: '#f3f4f6', color: '#6b7280' }} value={form.kd_dokter} readOnly placeholder="Klik Cari Pegawai" />
                  {!isEdit && (
                    <button type="button" onClick={() => setShowCariPegawai(true)}
                      style={{ padding: '0 12px', borderRadius: 8, border: '1px solid #4338ca', background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Cari Pegawai
                    </button>
                  )}
                </div>
              </F>
              <F label="Nama Dokter" req>
                <input style={{ ...iStyle, background: '#f3f4f6', color: '#6b7280' }} value={form.nm_dokter} readOnly placeholder="Terisi otomatis" />
              </F>
              <F label="Jenis Kelamin" req>
                <Sel>
                  <select style={selectStyle} value={form.jk} onChange={set('jk')}>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </Sel>
              </F>
              <F label="Golongan Darah">
                <Sel>
                  <select style={selectStyle} value={form.gol_drh} onChange={set('gol_drh')}>
                    {['A', 'B', 'O', 'AB', '-'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Sel>
              </F>
              <F label="Tempat Lahir">
                <input style={iStyle} value={form.tmp_lahir} onChange={set('tmp_lahir')} placeholder="Kota kelahiran" maxLength={20} />
              </F>
              <F label="Tanggal Lahir">
                <input type="date" style={iStyle} value={form.tgl_lahir} onChange={set('tgl_lahir')} />
              </F>
              <F label="Agama">
                <Sel>
                  <select style={selectStyle} value={form.agama} onChange={set('agama')}>
                    {['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDHA', 'KONGHUCU'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Sel>
              </F>
              <F label="Status Nikah">
                <Sel>
                  <select style={selectStyle} value={form.stts_nikah} onChange={set('stts_nikah')}>
                    {['BELUM MENIKAH', 'MENIKAH', 'JANDA', 'DUDHA'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Sel>
              </F>
              <F label="Spesialis" req>
                <Sel>
                  <select style={selectStyle} value={form.kd_sps} onChange={set('kd_sps')}>
                    <option value="">-- Pilih Spesialis --</option>
                    {spesialisList.map(s => <option key={s.kd_sps} value={s.kd_sps}>{s.nm_sps}</option>)}
                  </select>
                </Sel>
              </F>
              <F label="No. Telp">
                <input style={iStyle} value={form.no_telp} onChange={set('no_telp')} placeholder="Nomor telepon" maxLength={13} />
              </F>
              <F label="Email">
                <input type="text" style={iStyle} value={form.email} onChange={set('email')} placeholder="email@contoh.com" maxLength={70} />
              </F>
              <F label="Alumni">
                <input style={iStyle} value={form.alumni} onChange={set('alumni')} placeholder="Asal universitas" maxLength={30} />
              </F>
              <F label="No. Ijin Praktek">
                <input style={iStyle} value={form.no_ijn_praktek} onChange={set('no_ijn_praktek')} placeholder="Nomor SIP" maxLength={30} />
              </F>
              <div style={{ gridColumn: '1 / -1' }}>
                <F label="Alamat">
                  <input style={iStyle} value={form.almt_tgl} onChange={set('almt_tgl')} placeholder="Alamat lengkap" maxLength={60} />
                </F>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={onClose}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                Batal
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: saving ? '#a5b4fc' : '#4338ca', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ModalCariPegawai
        isOpen={showCariPegawai}
        onClose={() => setShowCariPegawai(false)}
        onSelect={(nik, nama) => handlePilihPegawai(nik, nama)}
      />
    </div>
  );
};
