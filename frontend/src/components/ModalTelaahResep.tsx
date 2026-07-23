import React from 'react';
import Swal from 'sweetalert2';
import type { ResepRalanRow } from '../modules/PermintaanResep';
import { getCurrentUserNip } from '../utils/currentUser';

// ============================================================================
// Modal "Telaah Resep" — padanan inventory/InventoryTelaahResep.java (2155
// baris), dialog terpisah yang di Java juga dipanggil dari DlgResepObat.java/
// DlgCariObat.java. Checklist tinjauan farmasi klinis standar RS ("7 Benar")
// sebelum obat diserahkan ke pasien — lihat
// backend/permintaan_resep_telaah_handler.go untuk rincian skema & alasan
// kenapa cuma satu aksi Simpan (upsert) di sini, bukan 2 tombol
// Simpan/Edit terpisah seperti Java.
// ============================================================================

type YaTidak = 'Ya' | 'Tidak';

type TelaahState = {
  resep_identifikasi_pasien: YaTidak;
  resep_ket_identifikasi_pasien: string;
  resep_tepat_obat: YaTidak;
  resep_ket_tepat_obat: string;
  resep_tepat_dosis: YaTidak;
  resep_ket_tepat_dosis: string;
  resep_tepat_cara_pemberian: YaTidak;
  resep_ket_tepat_cara_pemberian: string;
  resep_tepat_waktu_pemberian: YaTidak;
  resep_ket_tepat_waktu_pemberian: string;
  resep_ada_tidak_duplikasi_obat: YaTidak;
  resep_ket_ada_tidak_duplikasi_obat: string;
  resep_interaksi_obat: YaTidak;
  resep_ket_interaksi_obat: string;
  resep_kontra_indikasi_obat: YaTidak;
  resep_ket_kontra_indikasi_obat: string;
  obat_tepat_pasien: YaTidak;
  obat_tepat_obat: YaTidak;
  obat_tepat_dosis: YaTidak;
  obat_tepat_cara_pemberian: YaTidak;
  obat_tepat_waktu_pemberian: YaTidak;
};

const DEFAULT_STATE: TelaahState = {
  resep_identifikasi_pasien: 'Ya', resep_ket_identifikasi_pasien: '',
  resep_tepat_obat: 'Ya', resep_ket_tepat_obat: '',
  resep_tepat_dosis: 'Ya', resep_ket_tepat_dosis: '',
  resep_tepat_cara_pemberian: 'Ya', resep_ket_tepat_cara_pemberian: '',
  resep_tepat_waktu_pemberian: 'Ya', resep_ket_tepat_waktu_pemberian: '',
  resep_ada_tidak_duplikasi_obat: 'Ya', resep_ket_ada_tidak_duplikasi_obat: '',
  resep_interaksi_obat: 'Ya', resep_ket_interaksi_obat: '',
  resep_kontra_indikasi_obat: 'Ya', resep_ket_kontra_indikasi_obat: '',
  obat_tepat_pasien: 'Ya', obat_tepat_obat: 'Ya', obat_tepat_dosis: 'Ya',
  obat_tepat_cara_pemberian: 'Ya', obat_tepat_waktu_pemberian: 'Ya',
};

const RESEP_ITEMS: { key: keyof TelaahState; ketKey: keyof TelaahState; label: string }[] = [
  { key: 'resep_identifikasi_pasien', ketKey: 'resep_ket_identifikasi_pasien', label: '1. Tepat Identifikasi Pasien' },
  { key: 'resep_tepat_obat', ketKey: 'resep_ket_tepat_obat', label: '2. Tepat Obat' },
  { key: 'resep_tepat_dosis', ketKey: 'resep_ket_tepat_dosis', label: '3. Tepat Dosis' },
  { key: 'resep_tepat_cara_pemberian', ketKey: 'resep_ket_tepat_cara_pemberian', label: '4. Tepat Cara Pemberian' },
  { key: 'resep_tepat_waktu_pemberian', ketKey: 'resep_ket_tepat_waktu_pemberian', label: '5. Tepat Waktu Pemberian' },
  { key: 'resep_ada_tidak_duplikasi_obat', ketKey: 'resep_ket_ada_tidak_duplikasi_obat', label: '6. Ada Tidak Duplikasi Obat' },
  { key: 'resep_interaksi_obat', ketKey: 'resep_ket_interaksi_obat', label: '7. Interaksi Obat' },
  { key: 'resep_kontra_indikasi_obat', ketKey: 'resep_ket_kontra_indikasi_obat', label: '8. Kontra Indikasi Obat' },
];

const OBAT_ITEMS: { key: keyof TelaahState; label: string }[] = [
  { key: 'obat_tepat_pasien', label: '1. Tepat Pasien' },
  { key: 'obat_tepat_obat', label: '2. Tepat Obat' },
  { key: 'obat_tepat_dosis', label: '3. Tepat Dosis' },
  { key: 'obat_tepat_cara_pemberian', label: '4. Tepat Cara Pemberian' },
  { key: 'obat_tepat_waktu_pemberian', label: '5. Tepat Waktu Pemberian' },
];

type ModalTelaahResepProps = {
  resep: ResepRalanRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalTelaahResep: React.FC<ModalTelaahResepProps> = ({ resep, onClose, onSaved }) => {
  const [form, setForm] = React.useState<TelaahState>(DEFAULT_STATE);
  const [nip, setNip] = React.useState('');
  const [petugas, setPetugas] = React.useState<{ nip: string; nama: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!resep) return;
    setLoading(true);
    fetch('/api/petugas')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPetugas(Array.isArray(data) ? data : []))
      .catch(() => setPetugas([]));

    fetch(`/api/permintaan-resep/telaah/${encodeURIComponent(resep.no_resep)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setForm({
            resep_identifikasi_pasien: data.resep_identifikasi_pasien || 'Ya',
            resep_ket_identifikasi_pasien: data.resep_ket_identifikasi_pasien || '',
            resep_tepat_obat: data.resep_tepat_obat || 'Ya',
            resep_ket_tepat_obat: data.resep_ket_tepat_obat || '',
            resep_tepat_dosis: data.resep_tepat_dosis || 'Ya',
            resep_ket_tepat_dosis: data.resep_ket_tepat_dosis || '',
            resep_tepat_cara_pemberian: data.resep_tepat_cara_pemberian || 'Ya',
            resep_ket_tepat_cara_pemberian: data.resep_ket_tepat_cara_pemberian || '',
            resep_tepat_waktu_pemberian: data.resep_tepat_waktu_pemberian || 'Ya',
            resep_ket_tepat_waktu_pemberian: data.resep_ket_tepat_waktu_pemberian || '',
            resep_ada_tidak_duplikasi_obat: data.resep_ada_tidak_duplikasi_obat || 'Ya',
            resep_ket_ada_tidak_duplikasi_obat: data.resep_ket_ada_tidak_duplikasi_obat || '',
            resep_interaksi_obat: data.resep_interaksi_obat || 'Ya',
            resep_ket_interaksi_obat: data.resep_ket_interaksi_obat || '',
            resep_kontra_indikasi_obat: data.resep_kontra_indikasi_obat || 'Ya',
            resep_ket_kontra_indikasi_obat: data.resep_ket_kontra_indikasi_obat || '',
            obat_tepat_pasien: data.obat_tepat_pasien || 'Ya',
            obat_tepat_obat: data.obat_tepat_obat || 'Ya',
            obat_tepat_dosis: data.obat_tepat_dosis || 'Ya',
            obat_tepat_cara_pemberian: data.obat_tepat_cara_pemberian || 'Ya',
            obat_tepat_waktu_pemberian: data.obat_tepat_waktu_pemberian || 'Ya',
          });
          setNip(data.nip || getCurrentUserNip());
        } else {
          setForm(DEFAULT_STATE);
          setNip(getCurrentUserNip());
        }
      })
      .catch(() => {
        setForm(DEFAULT_STATE);
        setNip(getCurrentUserNip());
      })
      .finally(() => setLoading(false));
  }, [resep]);

  if (!resep) return null;

  const setField = <K extends keyof TelaahState>(key: K, value: TelaahState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSimpan = async () => {
    if (!nip) {
      Swal.fire({ icon: 'warning', title: 'Pilih Petugas dulu' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/permintaan-resep/telaah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_resep: resep.no_resep, nip, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Telaah resep tersimpan', timer: 2200, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    padding: '5px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', background: '#fff',
  };
  const ketInputStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 620, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Telaah Resep</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
          No. Resep {resep.no_resep} — {resep.nm_pasien} ({resep.no_rkm_medis})
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat data...</div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Petugas Farmasi</label>
              <select value={nip} onChange={(e) => setNip(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                <option value="">- Pilih -</option>
                {petugas.map((p) => (
                  <option key={p.nip} value={p.nip}>{p.nama}</option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '16px 0 8px', paddingBottom: 4, borderBottom: '1px solid #e5e7eb' }}>
              Telaah Resep
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RESEP_ITEMS.map((item) => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: '#374151' }}>{item.label}</div>
                  <select
                    value={form[item.key] as string}
                    onChange={(e) => setField(item.key, e.target.value as YaTidak)}
                    style={{ ...selectStyle, width: 80 }}
                  >
                    <option value="Ya">Ya</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Keterangan (opsional)"
                    value={form[item.ketKey] as string}
                    onChange={(e) => setField(item.ketKey, e.target.value)}
                    style={ketInputStyle}
                  />
                </div>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '16px 0 8px', paddingBottom: 4, borderBottom: '1px solid #e5e7eb' }}>
              Telaah Obat
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {OBAT_ITEMS.map((item) => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: '#374151' }}>{item.label}</div>
                  <select
                    value={form[item.key] as string}
                    onChange={(e) => setField(item.key, e.target.value as YaTidak)}
                    style={{ ...selectStyle, width: 80 }}
                  >
                    <option value="Ya">Ya</option>
                    <option value="Tidak">Tidak</option>
                  </select>
                </div>
              ))}
            </div>
          </>
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
