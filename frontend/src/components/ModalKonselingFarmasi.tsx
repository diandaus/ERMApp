import React from 'react';
import Swal from 'sweetalert2';
import type { ResepRalanRow } from '../modules/PermintaanResep';
import { getCurrentUserNip } from '../utils/currentUser';

// ============================================================================
// Modal "Konseling Farmasi" — padanan rekammedis/RMKonselingFarmasi.java,
// dipanggil dari BtnKonselingFarmasi di DlgDaftarPermintaanResep.java (sama
// baris toolbar dengan Riwayat Pasien/Obat Tervalidasi, bekerja atas
// resep/pasien yang sedang dipilih). Lihat backend/konseling_farmasi_handler.go
// untuk skema & kenapa Simpan/Ganti Java disatukan jadi satu upsert di sini.
//
// Field TglLahir/JK Java cuma konteks tampilan (bukan kolom tersimpan),
// sudah tersedia dari `resep` (ResepRalanRow) yang dikirim dari layar
// pemanggil — tidak perlu query ulang.
// ============================================================================

// Ikon panah bulat hijau di atas <select appearance:none> — disamakan
// dengan StepperIcon/pillSelectStyle di PermintaanResep.tsx (dropdown
// Dokter/Poli/Status Daftar Resep Dokter) supaya tema panah dropdown
// konsisten lintas modul Permintaan Resep.
const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 20,
      height: 20,
      borderRadius: '30%',
      background: '#059669',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      flexShrink: 0,
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

type YaTidak = 'Ya' | 'Tidak';

type KonselingState = {
  diagnosa: string;
  riwayat_alergi: string;
  pernah_datang: YaTidak;
  obat_pemakaian: string;
  keluhan: string;
  tindak_lanjut: string;
};

const DEFAULT_STATE: KonselingState = {
  diagnosa: '',
  riwayat_alergi: '',
  pernah_datang: 'Tidak',
  obat_pemakaian: '',
  keluhan: '',
  tindak_lanjut: '',
};

type ModalKonselingFarmasiProps = {
  resep: ResepRalanRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalKonselingFarmasi: React.FC<ModalKonselingFarmasiProps> = ({ resep, onClose, onSaved }) => {
  const [form, setForm] = React.useState<KonselingState>(DEFAULT_STATE);
  const [nip, setNip] = React.useState('');
  const [petugas, setPetugas] = React.useState<{ nip: string; nama: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sudahAda, setSudahAda] = React.useState(false);

  React.useEffect(() => {
    if (!resep) return;
    setLoading(true);
    fetch('/api/petugas')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPetugas(Array.isArray(data) ? data : []))
      .catch(() => setPetugas([]));

    fetch(`/api/permintaan-resep/konseling?no_rawat=${encodeURIComponent(resep.no_rawat)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.sudah_konseling) {
          setForm({
            diagnosa: data.diagnosa || '',
            riwayat_alergi: data.riwayat_alergi || '',
            pernah_datang: data.pernah_datang === 'Ya' ? 'Ya' : 'Tidak',
            obat_pemakaian: data.obat_pemakaian || '',
            keluhan: data.keluhan || '',
            tindak_lanjut: data.tindak_lanjut || '',
          });
          setNip(data.nip || getCurrentUserNip());
          setSudahAda(true);
        } else {
          setForm(DEFAULT_STATE);
          setNip(getCurrentUserNip());
          setSudahAda(false);
        }
      })
      .catch(() => {
        setForm(DEFAULT_STATE);
        setNip(getCurrentUserNip());
        setSudahAda(false);
      })
      .finally(() => setLoading(false));
  }, [resep]);

  if (!resep) return null;

  const setField = <K extends keyof KonselingState>(key: K, value: KonselingState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSimpan = async () => {
    if (!nip) {
      Swal.fire({ icon: 'warning', title: 'Pilih Petugas/Apoteker dulu' });
      return;
    }
    if (!form.diagnosa.trim()) {
      Swal.fire({ icon: 'warning', title: 'Diagnosa wajib diisi' });
      return;
    }
    if (!form.obat_pemakaian.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nama Obat, Dosis & Cara Pemakaian wajib diisi' });
      return;
    }
    if (!form.keluhan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Keluhan wajib diisi' });
      return;
    }
    if (!form.tindak_lanjut.trim()) {
      Swal.fire({ icon: 'warning', title: 'Tindak Lanjut wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/permintaan-resep/konseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: resep.no_rawat, nip, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Konseling farmasi tersimpan', timer: 2200, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
  };
  const selectStyle: React.CSSProperties = {
    padding: '7px 32px 7px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none',
    background: '#fff', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
  };
  const textareaStyle: React.CSSProperties = {
    ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
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
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Konseling Farmasi</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
          No. Rawat {resep.no_rawat} — {resep.nm_pasien} ({resep.no_rkm_medis})
          {sudahAda && <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 600, background: '#ecfdf5', color: '#059669' }}>Sudah ada catatan — mode edit</span>}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat data...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Petugas / Apoteker</label>
                <div style={{ position: 'relative' }}>
                  <select value={nip} onChange={(e) => setNip(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                    <option value="">- Pilih -</option>
                    {petugas.map((p) => (
                      <option key={p.nip} value={p.nip}>{p.nama}</option>
                    ))}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div style={{ width: 190 }}>
                <label style={labelStyle}>Pernah Konseling Sebelumnya</label>
                <div style={{ position: 'relative' }}>
                  <select value={form.pernah_datang} onChange={(e) => setField('pernah_datang', e.target.value as YaTidak)} style={{ ...selectStyle, width: '100%' }}>
                    <option value="Tidak">Tidak</option>
                    <option value="Ya">Ya</option>
                  </select>
                  <StepperIcon />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Diagnosa</label>
                <input type="text" maxLength={40} style={inputStyle} value={form.diagnosa} onChange={(e) => setField('diagnosa', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Riwayat Alergi</label>
                <input type="text" maxLength={30} style={inputStyle} value={form.riwayat_alergi} onChange={(e) => setField('riwayat_alergi', e.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Nama Obat, Dosis & Cara Pemakaian</label>
              <textarea maxLength={700} rows={3} style={textareaStyle} value={form.obat_pemakaian} onChange={(e) => setField('obat_pemakaian', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Keluhan</label>
              <textarea maxLength={300} rows={3} style={textareaStyle} value={form.keluhan} onChange={(e) => setField('keluhan', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Tindak Lanjut</label>
              <textarea maxLength={400} rows={3} style={textareaStyle} value={form.tindak_lanjut} onChange={(e) => setField('tindak_lanjut', e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={saving || loading}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: (saving || loading) ? '#9ca3af' : '#059669', color: '#fff', cursor: (saving || loading) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};
