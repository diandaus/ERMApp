import React from 'react';
import Swal from 'sweetalert2';

// ModalHasilLabPA — "Input Data Hasil Periksa Laboratorium PA". Padanan
// pola ModalHasilLabPK.tsx (avatar identitas, Dokter P.J./Petugas dgn
// autocomplete + StepperIcon, toggle waktu otomatis) tapi badan hasilnya
// narasi PA per pemeriksaan (Diagnosa Klinik/Makroskopik/Mikroskopik/
// Kesimpulan/Kesan) — bukan nilai parameter numerik dgn nilai rujukan.
// TTE/cetak PA belum diport di iterasi ini (menyusul kalau dibutuhkan).

type ExamDetail = { kd_jenis_prw: string; nm_perawatan: string };
type HasilItem = { kd_jenis_prw: string; diagnosa_klinik: string; makroskopik: string; mikroskopik: string; kesimpulan: string; kesan: string };

type OrderDetail = {
  noorder: string; no_rawat: string; no_rkm_medis: string; nm_pasien: string; umur: string;
  dokter_perujuk: string; nm_dokter: string; status: string;
  diagnosa_klinis: string; informasi_tambahan: string;
  sudah_ada_hasil: boolean; pemeriksaan: ExamDetail[];
  kd_dokter_pj: string; nm_dokter_pj: string;
  hasil: HasilItem[];
};

const pill: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12.5,
  outline: 'none', boxSizing: 'border-box', background: '#ffffff', color: '#111827',
};
const pillReadOnly: React.CSSProperties = { ...pill, background: '#f9fafb', color: '#374151' };
const labelSm: React.CSSProperties = { fontSize: 12.5, color: '#374151', flexShrink: 0, width: 96 };
const textareaStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' };

const StepperIcon = () => (
  <div
    style={{
      position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
      width: 20, height: 20, borderRadius: 4, background: '#2563eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', flexShrink: 0,
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

type Props = { noorder: string; nip?: string; onClose: () => void; onSaved: () => void };

export const ModalHasilLabPA: React.FC<Props> = ({ noorder, nip, onClose, onSaved }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [detail, setDetail] = React.useState<OrderDetail | null>(null);
  const [hasilMap, setHasilMap] = React.useState<Record<string, HasilItem>>({});

  const [petugasQuery, setPetugasQuery] = React.useState('');
  const [petugasNip, setPetugasNip] = React.useState('');
  const [petugasList, setPetugasList] = React.useState<{ nip: string; nama: string }[]>([]);
  const [showPetugasDropdown, setShowPetugasDropdown] = React.useState(false);

  const [dokterPjQuery, setDokterPjQuery] = React.useState('');
  const [kdDokterPj, setKdDokterPj] = React.useState('');
  const [dokterPjList, setDokterPjList] = React.useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [showDokterPjDropdown, setShowDokterPjDropdown] = React.useState(false);

  const [otomatisJam, setOtomatisJam] = React.useState(true);
  const [tglPeriksa, setTglPeriksa] = React.useState('');
  const [jamPeriksa, setJamPeriksa] = React.useState('');

  const [saving, setSaving] = React.useState(false);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/lab-pa/permintaan/${encodeURIComponent(noorder)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail permintaan');
        setDetail(data);
        const prefill: Record<string, HasilItem> = {};
        (data.pemeriksaan || []).forEach((e: ExamDetail) => {
          const match = (data.hasil || []).find((h: HasilItem) => h.kd_jenis_prw === e.kd_jenis_prw);
          prefill[e.kd_jenis_prw] = {
            kd_jenis_prw: e.kd_jenis_prw,
            diagnosa_klinik: match?.diagnosa_klinik || data.diagnosa_klinis || '',
            makroskopik: match?.makroskopik || '',
            mikroskopik: match?.mikroskopik || '',
            kesimpulan: match?.kesimpulan || '',
            kesan: match?.kesan || '',
          };
        });
        setHasilMap(prefill);
        if (data.kd_dokter_pj) {
          setKdDokterPj(data.kd_dokter_pj);
          setDokterPjQuery(data.nm_dokter_pj || '');
          setDokterPjList([{ kd_dokter: data.kd_dokter_pj, nm_dokter: data.nm_dokter_pj || '' }]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    })();
    const now = new Date();
    setTglPeriksa(todayStr());
    setJamPeriksa(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noorder]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(petugasQuery)}`);
      if (res.ok) setPetugasList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [petugasQuery]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/dokter?search=${encodeURIComponent(dokterPjQuery)}`);
      if (res.ok) setDokterPjList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [dokterPjQuery]);

  // Petugas default = user yg sedang login (nip) — cari by nip persis
  // (bukan substring) supaya tidak salah ambil petugas lain.
  React.useEffect(() => {
    if (!nip) return;
    (async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(nip)}`);
      if (!res.ok) return;
      const list: { nip: string; nama: string }[] = await res.json();
      const match = list.find((p) => p.nip === nip);
      if (match) {
        setPetugasNip(match.nip);
        setPetugasQuery(match.nama);
      }
    })();
  }, [nip]);

  const updateHasil = (kdJenisPrw: string, patch: Partial<HasilItem>) => {
    setHasilMap((prev) => ({ ...prev, [kdJenisPrw]: { ...prev[kdJenisPrw], ...patch } }));
  };

  const handleSubmit = async () => {
    if (!petugasNip) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Petugas dulu' });
      return;
    }
    if (!kdDokterPj) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Dokter P.J. dulu' });
      return;
    }
    const items = Object.values(hasilMap);
    const adaIsi = items.some((h) => h.makroskopik.trim() || h.mikroskopik.trim() || h.kesimpulan.trim() || h.kesan.trim());
    if (!adaIsi) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Isi minimal satu hasil pemeriksaan' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lab-pa/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noorder,
          no_rawat: detail!.no_rawat,
          nip: petugasNip,
          kd_dokter: kdDokterPj,
          pemeriksaan: items,
          tgl: otomatisJam ? '' : tglPeriksa,
          jam: otomatisJam ? '' : jamPeriksa,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan hasil pemeriksaan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Hasil pemeriksaan lab PA berhasil disimpan', timer: 2000, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || error || !detail) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
        onClick={onClose}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 420, maxWidth: '92vw', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, color: '#111827' }}>Input Data Hasil Periksa Laboratorium PA</span>
            <button
              type="button" onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >&times;</button>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat...</div>
          ) : (
            <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={onClose}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>

        {/* Panel kiri — Data Permintaan (identitas + Dokter P.J./Petugas/waktu) */}
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 340, maxWidth: '92vw', height: '90vh', maxHeight: '90vh', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#2563eb" />
                <path d="M12 14C6.47715 14 2 17.134 2 21C2 21.5523 2.44772 22 3 22H21C21.5523 22 22 21.5523 22 21C22 17.134 17.5228 14 12 14Z" fill="#2563eb" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', wordBreak: 'break-word' }}>
                {detail.nm_pasien}{detail.umur ? ` (${detail.umur})` : ''}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>No.RM {detail.no_rkm_medis}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>No.Rawat {detail.no_rawat}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...labelSm, width: 'auto' }}>Dokter P.J. :</span>
              <div style={{ position: 'relative' }}>
                <input
                  value={dokterPjQuery}
                  onChange={(e) => { setDokterPjQuery(e.target.value); setKdDokterPj(''); setShowDokterPjDropdown(true); }}
                  onFocus={() => setShowDokterPjDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDokterPjDropdown(false), 200)}
                  placeholder="Cari dokter..."
                  style={{ ...pill, width: '100%', paddingRight: 28 }}
                />
                <StepperIcon />
                {showDokterPjDropdown && dokterPjList.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                    {dokterPjList.map((d) => (
                      <div key={d.kd_dokter} onClick={() => { setKdDokterPj(d.kd_dokter); setDokterPjQuery(d.nm_dokter); setShowDokterPjDropdown(false); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #e5e7eb' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#f9fafb'}
                      >{d.nm_dokter}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...labelSm, width: 'auto' }}>Petugas :</span>
              <div style={{ position: 'relative' }}>
                <input
                  value={petugasQuery}
                  onChange={(e) => { setPetugasQuery(e.target.value); setPetugasNip(''); setShowPetugasDropdown(true); }}
                  onFocus={() => setShowPetugasDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPetugasDropdown(false), 200)}
                  placeholder="Cari nama petugas..."
                  style={{ ...pill, width: '100%', paddingRight: 28 }}
                />
                <StepperIcon />
                {showPetugasDropdown && petugasList.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                    {petugasList.map((p) => (
                      <div key={p.nip} onClick={() => { setPetugasNip(p.nip); setPetugasQuery(p.nama); setShowPetugasDropdown(false); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #e5e7eb' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#f9fafb'}
                      >{p.nama} <span style={{ color: '#9ca3af' }}>({p.nip})</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...labelSm, width: 'auto' }}>Dokter Perujuk :</span>
              <input readOnly value={detail.nm_dokter || '-'} style={pillReadOnly} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...labelSm, width: 'auto' }}>Diagnosis Klinis :</span>
              <input readOnly value={detail.diagnosa_klinis || '-'} style={pillReadOnly} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={otomatisJam} onChange={(e) => setOtomatisJam(e.target.checked)} />
              Waktu periksa otomatis (sekarang)
            </label>
            {!otomatisJam && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={tglPeriksa} onChange={(e) => setTglPeriksa(e.target.value)} style={{ ...pill, flex: 1 }} />
                <input type="time" value={jamPeriksa} onChange={(e) => setJamPeriksa(e.target.value)} style={{ ...pill, flex: 1 }} />
              </div>
            )}
          </div>
        </div>

        {/* Panel kanan — hasil per pemeriksaan. Header & footer TIDAK ikut
            scroll (flexShrink: 0, di luar area overflowY) — hanya daftar
            kartu pemeriksaan di tengah yg scroll. */}
        <div
          style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 560, maxWidth: '92vw', height: '90vh', maxHeight: '90vh', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 15, color: '#111827' }}>Input Data Hasil Periksa Laboratorium PA</span>
            <button
              type="button" onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >&times;</button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {detail.pemeriksaan.map((e) => {
              const h = hasilMap[e.kd_jenis_prw] || { kd_jenis_prw: e.kd_jenis_prw, diagnosa_klinik: '', makroskopik: '', mikroskopik: '', kesimpulan: '', kesan: '' };
              return (
                <div key={e.kd_jenis_prw} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{e.nm_perawatan}</div>
                  <div>
                    <label style={{ fontSize: 11.5, color: '#374151', display: 'block', marginBottom: 3 }}>Diagnosa Klinik</label>
                    <input
                      value={h.diagnosa_klinik}
                      onChange={(ev) => updateHasil(e.kd_jenis_prw, { diagnosa_klinik: ev.target.value })}
                      style={{ ...pill, width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: '#374151', display: 'block', marginBottom: 3 }}>Makroskopik</label>
                    <textarea rows={3} value={h.makroskopik} onChange={(ev) => updateHasil(e.kd_jenis_prw, { makroskopik: ev.target.value })} style={textareaStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: '#374151', display: 'block', marginBottom: 3 }}>Mikroskopik</label>
                    <textarea rows={3} value={h.mikroskopik} onChange={(ev) => updateHasil(e.kd_jenis_prw, { mikroskopik: ev.target.value })} style={textareaStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: '#374151', display: 'block', marginBottom: 3 }}>Kesimpulan</label>
                    <textarea rows={2} value={h.kesimpulan} onChange={(ev) => updateHasil(e.kd_jenis_prw, { kesimpulan: ev.target.value })} style={textareaStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: '#374151', display: 'block', marginBottom: 3 }}>Kesan</label>
                    <textarea rows={2} value={h.kesan} onChange={(ev) => updateHasil(e.kd_jenis_prw, { kesan: ev.target.value })} style={textareaStyle} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
            <button
              type="button" onClick={handleSubmit} disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Hasil'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
