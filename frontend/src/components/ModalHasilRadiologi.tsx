import React from 'react';
import Swal from 'sweetalert2';

// ModalHasilRadiologi — "Input Data Hasil Periksa Radiologi", padanan
// header form DlgPeriksaRadiologi.java (Khanza Desktop): No.Rawat/No.RM/
// Pasien, Dokter P.J. (default dari set_pjlab.kd_dokterrad — Penanggung
// Jawab Radiologi, bisa diganti manual), Petugas (radiografer, dicari
// manual), Dokter Perujuk (tetap, dari permintaan), Tanggal+Jam (checkbox
// "Otomatis" = pakai waktu sekarang, sama seperti ChkJln di Java). Di
// bawah header: gambar dari PACS Orthanc (kiri, reuse endpoint preview yg
// sama dgn ModalityWorklist.tsx) dan input Hasil/Bacaan (kanan).

type ExamDetail = { kd_jenis_prw: string; nm_perawatan: string };

type OrderDetail = {
  noorder: string; no_rawat: string; no_rkm_medis: string; nm_pasien: string;
  dokter_perujuk: string; nm_dokter: string; status: string;
  diagnosa_klinis: string; informasi_tambahan: string;
  sudah_ada_hasil: boolean; pemeriksaan: ExamDetail[];
  kd_dokter_pj: string; nm_dokter_pj: string;
  hasil_terakhir: string;
};

type ExamForm = {
  kd_jenis_prw: string; nm_perawatan: string; checked: boolean;
  proyeksi: string; kV: string; mAS: string; FFD: string; BSF: string; inak: string; jml_penyinaran: string; dosis: string;
};

type DicomInstance = { id: string; series_id: string; modality: string };
type DicomSeries = { series_id: string; modality: string; study_date: string; instance_count: number; webviewer_url: string };

const pill: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', background: '#ffffff', color: '#111827',
};
const pillReadOnly: React.CSSProperties = { ...pill, background: '#f9fafb', color: '#374151' };
const labelSm: React.CSSProperties = { fontSize: 13, color: '#374151', flexShrink: 0, width: 96 };
const clipBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 4, border: '1px solid #e5e7eb', background: '#ffffff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', flexShrink: 0, color: '#9ca3af',
};

const ClipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

type Props = { noorder: string; nip?: string; onClose: () => void; onSaved: () => void };

export const ModalHasilRadiologi: React.FC<Props> = ({ noorder, nip, onClose, onSaved }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [detail, setDetail] = React.useState<OrderDetail | null>(null);
  const [exams, setExams] = React.useState<ExamForm[]>([]);
  const [hasil, setHasil] = React.useState('');

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

  const [foto, setFoto] = React.useState<{ instances: DicomInstance[]; series: DicomSeries[] }>({ instances: [], series: [] });
  const [loadingFoto, setLoadingFoto] = React.useState(false);

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
        const res = await fetch(`/api/radiologi/permintaan/${encodeURIComponent(noorder)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail permintaan');
        setDetail(data);
        setExams((data.pemeriksaan || []).map((e: ExamDetail) => ({
          kd_jenis_prw: e.kd_jenis_prw, nm_perawatan: e.nm_perawatan, checked: true,
          proyeksi: '', kV: '', mAS: '', FFD: '', BSF: '', inak: '', jml_penyinaran: '', dosis: '',
        })));
        if (data.kd_dokter_pj) {
          setKdDokterPj(data.kd_dokter_pj);
          setDokterPjQuery(data.nm_dokter_pj || '');
          setDokterPjList([{ kd_dokter: data.kd_dokter_pj, nm_dokter: data.nm_dokter_pj || '' }]);
        }
        if (data.hasil_terakhir) {
          setHasil(data.hasil_terakhir);
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
    (async () => {
      setLoadingFoto(true);
      try {
        const res = await fetch(`/api/satu-sehat/dicom/preview-list/${noorder}`);
        const data = await res.json();
        if (res.ok) {
          setFoto({ instances: Array.isArray(data.instances) ? data.instances : [], series: Array.isArray(data.series) ? data.series : [] });
        }
      } catch { /* silent — foto opsional */ }
      finally { setLoadingFoto(false); }
    })();
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

  // Petugas default = user yg sedang login (nip), padanan KdPtg.setText
  // (akses.getkode()) di DlgPeriksaRadiologi.java saat form dibuka — cari
  // by nip persis (bukan substring) supaya tidak salah ambil petugas lain.
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

  const updateExam = (idx: number, patch: Partial<ExamForm>) => {
    setExams((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
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
    const checkedExams = exams.filter((e) => e.checked);
    if (checkedExams.length === 0 && !hasil.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Centang minimal satu pemeriksaan atau isi Hasil/Bacaan' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/radiologi/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noorder,
          no_rawat: detail!.no_rawat,
          nip: petugasNip,
          kd_dokter: kdDokterPj,
          pemeriksaan: checkedExams.map((e) => ({
            kd_jenis_prw: e.kd_jenis_prw, proyeksi: e.proyeksi, kV: e.kV, mAS: e.mAS,
            FFD: e.FFD, BSF: e.BSF, inak: e.inak, jml_penyinaran: e.jml_penyinaran, dosis: e.dosis,
          })),
          hasil: hasil.trim(),
          tgl: otomatisJam ? '' : tglPeriksa,
          jam: otomatisJam ? '' : jamPeriksa,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan hasil pemeriksaan');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Hasil pemeriksaan radiologi berhasil disimpan', timer: 2000, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 1100, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Input Data Hasil Periksa Radiologi</span>
          <button
            type="button" onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
              background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
            }}
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>Memuat...</div>
        ) : error ? (
          <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{error}</div>
        ) : detail && (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Header identitas — pill fields, padanan PanelInput DlgPeriksaRadiologi.java */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={labelSm}>No.Rawat :</span>
                <input readOnly value={detail.no_rawat} style={{ ...pillReadOnly, width: 190 }} />
                <input readOnly value={detail.no_rkm_medis} style={{ ...pillReadOnly, width: 100 }} />
                <input readOnly value={detail.nm_pasien} style={{ ...pillReadOnly, flex: 1 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={labelSm}>Dokter P.J. :</span>
                <input readOnly value={kdDokterPj} style={{ ...pillReadOnly, width: 100 }} />
                <div style={{ position: 'relative', width: 200 }}>
                  <input
                    value={dokterPjQuery}
                    onChange={(e) => { setDokterPjQuery(e.target.value); setKdDokterPj(''); setShowDokterPjDropdown(true); }}
                    onFocus={() => setShowDokterPjDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDokterPjDropdown(false), 200)}
                    placeholder="Cari dokter..."
                    style={{ ...pill, width: '100%' }}
                  />
                  {showDokterPjDropdown && dokterPjList.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                      {dokterPjList.map((d) => (
                        <div key={d.kd_dokter} onClick={() => { setKdDokterPj(d.kd_dokter); setDokterPjQuery(d.nm_dokter); setShowDokterPjDropdown(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                        >{d.nm_dokter}</div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={clipBtn}><ClipIcon /></div>

                <span style={{ ...labelSm, width: 60, marginLeft: 8 }}>Petugas :</span>
                <input readOnly value={petugasNip} style={{ ...pillReadOnly, width: 90 }} />
                <div style={{ position: 'relative', width: 200 }}>
                  <input
                    value={petugasQuery}
                    onChange={(e) => { setPetugasQuery(e.target.value); setPetugasNip(''); setShowPetugasDropdown(true); }}
                    onFocus={() => setShowPetugasDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPetugasDropdown(false), 200)}
                    placeholder="Cari nama petugas..."
                    style={{ ...pill, width: '100%' }}
                  />
                  {showPetugasDropdown && petugasList.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10 }}>
                      {petugasList.map((p) => (
                        <div key={p.nip} onClick={() => { setPetugasNip(p.nip); setPetugasQuery(p.nama); setShowPetugasDropdown(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                        >{p.nama} <span style={{ color: '#9ca3af' }}>({p.nip})</span></div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={clipBtn}><ClipIcon /></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={labelSm}>Dokter Perujuk :</span>
                <input readOnly value={detail.dokter_perujuk} style={{ ...pillReadOnly, width: 100 }} />
                <input readOnly value={detail.nm_dokter} style={{ ...pillReadOnly, width: 200 }} />
                <div style={clipBtn}><ClipIcon /></div>

                <span style={{ ...labelSm, width: 60, marginLeft: 8 }}>Tanggal :</span>
                <input
                  type="date" value={tglPeriksa} onChange={(e) => setTglPeriksa(e.target.value)}
                  disabled={otomatisJam} style={{ ...pill, width: 150, opacity: otomatisJam ? 0.6 : 1 }}
                />
                <span style={{ fontSize: 13, color: '#374151' }}>Jam :</span>
                <input
                  type="time" value={jamPeriksa} onChange={(e) => setJamPeriksa(e.target.value)}
                  disabled={otomatisJam} style={{ ...pill, width: 110, opacity: otomatisJam ? 0.6 : 1 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={otomatisJam} onChange={(e) => setOtomatisJam(e.target.checked)} />
                  Otomatis
                </label>
              </div>
            </div>

            {/* Pemeriksaan — checklist + data teknis, padanan tabel pemeriksaan Java */}
            <div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['', 'Pemeriksaan', 'Proyeksi', 'kV', 'mAS', 'FFD', 'BSF', 'Inak', 'Jml.Penyinaran', 'Dosis'].map((h) => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((e, idx) => (
                      <tr key={e.kd_jenis_prw} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="checkbox" checked={e.checked} onChange={(ev) => updateExam(idx, { checked: ev.target.checked })} />
                        </td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontWeight: 500 }}>{e.nm_perawatan}</td>
                        {(['proyeksi', 'kV', 'mAS', 'FFD', 'BSF', 'inak', 'jml_penyinaran', 'dosis'] as const).map((f) => (
                          <td key={f} style={{ padding: '4px' }}>
                            <input
                              type="text" style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                              value={e[f]} onChange={(ev) => updateExam(idx, { [f]: ev.target.value } as Partial<ExamForm>)}
                              disabled={!e.checked}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Foto Orthanc (kiri) + Hasil (kanan) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, minHeight: 260 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Foto dari Orthanc</span>
                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, overflowY: 'auto', background: '#000', minHeight: 240 }}>
                  {loadingFoto ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Memuat dari Orthanc...</div>
                  ) : foto.instances.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Belum ada gambar di Orthanc untuk order ini</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                      {foto.instances.map((inst) => (
                        <div key={inst.id} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #374151' }}>
                          <img
                            src={`/api/satu-sehat/dicom/preview-image/${inst.id}`}
                            alt={inst.modality || 'DICOM'}
                            style={{ width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'contain', background: '#111827' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {foto.series.length > 0 && (
                  <a
                    href={foto.series[0].webviewer_url} target="_blank" rel="noopener noreferrer"
                    style={{ alignSelf: 'flex-start', fontSize: 11, color: '#2563eb', textDecoration: 'none' }}
                  >
                    Buka di Orthanc Viewer ↗
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Hasil</span>
                <textarea
                  value={hasil} onChange={(e) => setHasil(e.target.value)}
                  placeholder="Tulis hasil bacaan/expertise radiologi..."
                  style={{ flex: 1, minHeight: 240, width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {detail.sudah_ada_hasil && (
              <div style={{ fontSize: 12, color: '#92400e', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                ⚠ Permintaan ini sudah pernah diisi hasilnya — submit ulang akan menambahkan catatan pemeriksaan baru.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => Swal.fire({ icon: 'info', title: 'Segera Hadir', text: 'Fitur kirim hasil pemeriksaan radiologi ke WhatsApp akan dikembangkan.' })}
                title="Kirim Ke WA (segera hadir)"
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #25D366', background: '#fff', color: '#25D366', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.13c-.24.68-1.4 1.3-1.93 1.35-.5.05-1.02.24-3.41-.71-2.9-1.16-4.76-4.06-4.9-4.25-.14-.19-1.17-1.56-1.17-2.98s.75-2.12 1.02-2.41c.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.83 2 .9 2.14.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.29.14.46.12.63-.07.17-.19.72-.83.91-1.12.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.71-.17 1.39z"></path>
                </svg>
                Kirim Ke WA
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => Swal.fire({ icon: 'info', title: 'Segera Hadir', text: 'Fitur cetak hasil pemeriksaan radiologi akan dikembangkan.' })}
                  title="Cetak Hasil Pemeriksaan (segera hadir)"
                  style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                </button>
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
        )}
      </div>
    </div>
  );
};
