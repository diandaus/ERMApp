import React from 'react';
import Swal from 'sweetalert2';
import type { ResepRalanRow } from '../modules/PermintaanResep';
import { getCurrentPetugas, getCurrentUserNip } from '../utils/currentUser';
import type { InformasiObatItem } from './ModalInformasiObat';
import { ModalCariPetugas } from './ModalCariPetugas';

// ============================================================================
// Modal "Jawab Informasi Obat" — padanan WindowInput jawaban di
// permintaan/DlgPermintaanPelayananInformasiObat.java, dipisah dari
// ModalInformasiObat.tsx (yang murni form "Pertanyaan Baru") supaya tombol
// "Jawab" di sub-tab "Sudah Ada Pertanyaan" (TabInformasiObat) langsung
// membuka modal INI dalam mode menjawab.
//
// SENGAJA cuma satu form flat (No.Permintaan/Tanggal Jawaban/Penyampaian,
// Metode Jawab/Apoteker, Jawaban, Referensi, Batal/Simpan) — TANPA daftar
// pertanyaan/badge/Hapus seperti versi sebelumnya, atas permintaan user
// supaya modal ini fokus satu tugas: jawab SATU pertanyaan yang paling
// butuh jawaban (yang paling baru & belum dijawab; kalau semua entri utk
// no_rawat itu sudah dijawab, jatuh balik ke entri paling baru dalam mode
// edit). Melihat daftar lengkap/menghapus entri tetap bisa lewat dropdown
// inline di TabInformasiObat (PermintaanResep.tsx).
// ============================================================================

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 20, height: 20, borderRadius: '20%', background: '#059669',
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
const PENYAMPAIAN_JAWABAN_OPTIONS = ['Segera', 'Dalam 24 Jam', 'Lebih Dari 24 Jam'];

type JawabanForm = {
  metode: string;
  penyampaian_jawaban: string;
  jawaban: string;
  referensi: string;
  nip: string;
};

const DEFAULT_JAWABAN_FORM: JawabanForm = { metode: 'Lisan', penyampaian_jawaban: 'Segera', jawaban: '', referensi: '', nip: '' };

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  padding: '7px 32px 7px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5, outline: 'none',
  background: '#fff', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', width: '100%',
};
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 56, fontFamily: 'inherit' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 };
const pillReadOnly: React.CSSProperties = { ...inputStyle, background: '#f3f4f6', color: '#374151' };

// Pill "Tanggal Jawaban : [tanggal] [hh] [mm] [ss]" — padanan TanggalJawab
// (JXDatePicker) di WindowInput jawaban Java, DIBUAT EDITABLE lewat
// checkbox "Waktu Sekarang" (opsional, boleh diedit manual kalau jawaban
// dicatat belakangan) — nilainya BENAR dikirim ke backend sebagai
// tanggal_jawab kalau waktu otomatis dimatikan (lihat handleSimpanJawaban).
const pillSelectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 30, cursor: 'pointer' };

const PillStepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 20, height: 20, borderRadius: '20%', background: '#059669',
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
  <div style={{ position: 'relative', width: 58, flexShrink: 0 }}>
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...pillSelectStyle, ...(disabled ? { background: '#f3f4f6', cursor: 'default' } : {}) }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <PillStepperIcon />
  </div>
);

const pad2 = (n: number) => String(n).padStart(2, '0');
const range = (n: number) => Array.from({ length: n }, (_, i) => ({ value: pad2(i), label: pad2(i) }));

type ModalJawabPioProps = {
  resep: ResepRalanRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export const ModalJawabPio: React.FC<ModalJawabPioProps> = ({ resep, onClose, onSaved }) => {
  const [loading, setLoading] = React.useState(false);

  const [targetItem, setTargetItem] = React.useState<InformasiObatItem | null>(null);
  const [answerForm, setAnswerForm] = React.useState<JawabanForm>(DEFAULT_JAWABAN_FORM);
  const [apotekerNama, setApotekerNama] = React.useState('');
  const [showCariApoteker, setShowCariApoteker] = React.useState(false);
  const [savingAnswer, setSavingAnswer] = React.useState(false);

  const [tanggalJawab, setTanggalJawab] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [jamJawab, setJamJawab] = React.useState(() => pad2(new Date().getHours()));
  const [menitJawab, setMenitJawab] = React.useState(() => pad2(new Date().getMinutes()));
  const [detikJawab, setDetikJawab] = React.useState(() => pad2(new Date().getSeconds()));
  const [waktuOtomatisJawab, setWaktuOtomatisJawab] = React.useState(true);

  React.useEffect(() => {
    if (!waktuOtomatisJawab) return;
    const t = setInterval(() => {
      const n = new Date();
      setTanggalJawab(n.toISOString().slice(0, 10));
      setJamJawab(pad2(n.getHours()));
      setMenitJawab(pad2(n.getMinutes()));
      setDetikJawab(pad2(n.getSeconds()));
    }, 1000);
    return () => clearInterval(t);
  }, [waktuOtomatisJawab]);

  const loadItem = React.useCallback((item: InformasiObatItem) => {
    setTargetItem(item);
    setAnswerForm({
      metode: item.metode_jawab || 'Lisan',
      penyampaian_jawaban: item.penyampaian_jawaban || 'Segera',
      jawaban: item.jawaban || '',
      referensi: item.referensi || '',
      nip: item.nip_apoteker || getCurrentUserNip(),
    });
    setApotekerNama(item.nama_apoteker || (item.nip_apoteker ? '' : getCurrentPetugas()));
    const now = new Date();
    setTanggalJawab(now.toISOString().slice(0, 10));
    setJamJawab(pad2(now.getHours()));
    setMenitJawab(pad2(now.getMinutes()));
    setDetikJawab(pad2(now.getSeconds()));
    setWaktuOtomatisJawab(true);
  }, []);

  const fetchItems = React.useCallback(async () => {
    if (!resep) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/permintaan-resep/informasi-obat?no_rawat=${encodeURIComponent(resep.no_rawat)}`);
      const data = await res.json();
      const list: InformasiObatItem[] = Array.isArray(data) ? data : [];
      // Pertanyaan paling baru yang belum dijawab diprioritaskan; kalau
      // semua sudah dijawab, jatuh balik ke entri paling baru (edit mode)
      // — list sudah terurut DESC by tanggal dari backend.
      const target = list.find((it) => !it.sudah_dijawab) ?? list[0] ?? null;
      if (target) loadItem(target);
      else setTargetItem(null);
    } catch {
      setTargetItem(null);
    } finally {
      setLoading(false);
    }
  }, [resep, loadItem]);

  React.useEffect(() => {
    if (!resep) return;
    fetchItems();
  }, [resep, fetchItems]);

  if (!resep) return null;

  const setAnswerField = <K extends keyof JawabanForm>(key: K, value: JawabanForm[K]) => {
    setAnswerForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSimpanJawaban = async () => {
    if (!targetItem) return;
    if (!answerForm.nip) {
      Swal.fire({ icon: 'warning', title: 'Pilih Apoteker dulu' });
      return;
    }
    if (!answerForm.jawaban.trim()) {
      Swal.fire({ icon: 'warning', title: 'Jawaban wajib diisi' });
      return;
    }
    if (!answerForm.referensi.trim()) {
      Swal.fire({ icon: 'warning', title: 'Referensi wajib diisi' });
      return;
    }
    setSavingAnswer(true);
    try {
      const res = await fetch('/api/permintaan-resep/informasi-obat/jawaban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_permintaan: targetItem.no_permintaan,
          ...answerForm,
          // tanggal_jawab cuma dikirim kalau "Waktu Sekarang" dimatikan
          // (edit manual) — kalau tidak, backend pakai NOW() sendiri.
          tanggal_jawab: waktuOtomatisJawab ? '' : `${tanggalJawab} ${jamJawab}:${menitJawab}:${detikJawab}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jawaban');
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Jawaban tersimpan', timer: 2000, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSavingAnswer(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 700, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          Jawab Informasi Obat — {resep.nm_pasien} ({resep.no_rkm_medis})
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>No. Rawat {resep.no_rawat}</div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat data...</div>
        ) : !targetItem ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Belum ada pertanyaan Informasi Obat untuk kunjungan ini</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Uraian Pertanyaan</label>
              <textarea readOnly rows={2} value={targetItem.uraian_pertanyaan} style={{ ...textareaStyle, ...pillReadOnly, resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 130, flexShrink: 0 }}>
                <label style={labelStyle}>No. Permintaan</label>
                <input readOnly value={targetItem.no_permintaan} style={pillReadOnly} />
              </div>
              <div style={{ flex: '1 1 300px' }}>
                <label style={labelStyle}>Tanggal Jawaban</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={tanggalJawab}
                    onChange={(e) => setTanggalJawab(e.target.value)}
                    disabled={waktuOtomatisJawab}
                    style={{ ...(waktuOtomatisJawab ? pillReadOnly : inputStyle), width: 130, flexShrink: 0 }}
                  />
                  <PillSelect value={jamJawab} onChange={setJamJawab} options={range(24)} disabled={waktuOtomatisJawab} />
                  <PillSelect value={menitJawab} onChange={setMenitJawab} options={range(60)} disabled={waktuOtomatisJawab} />
                  <PillSelect value={detikJawab} onChange={setDetikJawab} options={range(60)} disabled={waktuOtomatisJawab} />
                  <input type="checkbox" checked={waktuOtomatisJawab} onChange={(e) => setWaktuOtomatisJawab(e.target.checked)} title="Waktu Sekarang" style={{ accentColor: '#059669' }} />
                </div>
              </div>
              <div style={{ flex: '1 1 90px' }}>
                <label style={labelStyle}>Penyampaian</label>
                <div style={{ position: 'relative' }}>
                  <select style={selectStyle} value={answerForm.penyampaian_jawaban} onChange={(e) => setAnswerField('penyampaian_jawaban', e.target.value)}>
                    {PENYAMPAIAN_JAWABAN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 200, flexShrink: 0 }}>
                <label style={labelStyle}>Metode Jawab</label>
                <div style={{ position: 'relative' }}>
                  <select style={selectStyle} value={answerForm.metode} onChange={(e) => setAnswerField('metode', e.target.value)}>
                    {METODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <StepperIcon />
                </div>
              </div>
              <div style={{ flex: '1 1 240px' }}>
                <label style={labelStyle}>Apoteker</label>
                {answerForm.nip ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: '1px solid #1AB1E5', background: '#f0f9ff', borderRadius: 4,
                    padding: '7px 10px', fontSize: 12.5, boxSizing: 'border-box',
                  }}>
                    <span>{answerForm.nip} - <strong>{apotekerNama}</strong></span>
                    <button
                      type="button"
                      onClick={() => setShowCariApoteker(true)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                    >
                      Ganti
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowCariApoteker(true)}
                    style={{
                      ...inputStyle, cursor: 'pointer', color: '#9ca3af', background: '#ffffff',
                    }}
                  >
                    Klik untuk pilih apoteker...
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Jawaban</label>
              <textarea maxLength={500} rows={4} style={textareaStyle} value={answerForm.jawaban} onChange={(e) => setAnswerField('jawaban', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Referensi</label>
              <textarea maxLength={500} rows={3} style={textareaStyle} value={answerForm.referensi} onChange={(e) => setAnswerField('referensi', e.target.value)} />
            </div>
          </div>
        )}

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
            onClick={handleSimpanJawaban}
            disabled={savingAnswer || !targetItem}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: (savingAnswer || !targetItem) ? '#9ca3af' : '#059669', color: '#fff',
              cursor: (savingAnswer || !targetItem) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            {savingAnswer ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      <ModalCariPetugas
        isOpen={showCariApoteker}
        onClose={() => setShowCariApoteker(false)}
        onSelect={(nip, nama) => {
          setAnswerField('nip', nip);
          setApotekerNama(nama);
        }}
      />
    </div>
  );
};
