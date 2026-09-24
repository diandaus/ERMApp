import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentUserNip } from '../utils/currentUser';

// ModalInputUSG.tsx — "Input Hasil Pemeriksaan USG" (Pemeriksaan.tsx tab
// "Pemeriksaan USG", RadTab.tsx kategoriUsg). SENGAJA modal BARU & TERPISAH
// dari ModalHasilRadiologi.tsx (dipakai modul Radiologi.tsx/worklist
// lintas pasien) — bukan reuse, krn ModalHasilRadiologi punya bagian "Foto
// dari Orthanc" yg fallback cari SEMUA studi pasien by No.RM begitu
// AccessionNumber belum ketemu (padanan tbListDicom Khanza lama, lihat
// getDicomPreviewList di dicom_handler.go) — utk order USG yg BARU dibuat
// & belum pernah dikirim ke Orthanc, ini malah nampilin foto rontgen LAMA
// yg tidak relevan sama sekali (ketauan dari screenshot user, order baru
// tapi foto tulang belakang lama ikut muncul). Modal ini SENGAJA TIDAK
// ada bagian foto Orthanc sama sekali.
//
// Shell slide-in dari kanan PERSIS pola ModalInputRad.tsx/ModalInputLab.tsx
// (overlay fixed + panel anchor kanan, header breadcrumb pasien + close
// bulat, body scrollable, footer sticky "Simpan"). Backend REUSE 100% yg
// sudah ada (POST /api/radiologi/hasil, GET /api/radiologi/permintaan/:noorder
// — radiologi_hasil_handler.go, sudah mereplikasi persis simpan() di
// DlgPeriksaRadiologi.java Khanza), tidak ada perubahan backend.
//
// Dokter P.J. & Dokter Perujuk SENGAJA read-only, terkunci ke dokter
// poliklinik pasien ini (patient.kd_dokter/nm_dokter dari Pemeriksaan.tsx —
// DPJP kunjungan) — bukan dipilih manual spt ModalHasilRadiologi, krn alur
// USG Kandungan: dokter poliklinik yg periksa sendiri, tidak ada
// radiolog/rujukan terpisah.

type ModalInputUSGProps = {
  patient: any;
  noorder: string;
  onClose: () => void;
  onSaved: () => void;
};

type ExamRow = { kd_jenis_prw: string; nm_perawatan: string };

export const ModalInputUSG: React.FC<ModalInputUSGProps> = ({ patient, noorder, onClose, onSaved }) => {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const [loading, setLoading] = React.useState(true);
  const [exams, setExams] = React.useState<ExamRow[]>([]);
  const [hasil, setHasil] = React.useState('');

  const [petugasQuery, setPetugasQuery] = React.useState('');
  const [petugasNip, setPetugasNip] = React.useState('');
  const [petugasList, setPetugasList] = React.useState<{ nip: string; nama: string }[]>([]);
  const [showPetugasDropdown, setShowPetugasDropdown] = React.useState(false);

  const [otomatisJam, setOtomatisJam] = React.useState(true);
  const [tglPeriksa, setTglPeriksa] = React.useState('');
  const [jamPeriksa, setJamPeriksa] = React.useState('');

  const [saving, setSaving] = React.useState(false);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Muat detail permintaan — daftar pemeriksaan (biasanya cuma "USG",
  // kode RJ.OBG) + hasil/petugas yg SUDAH pernah diisi sebelumnya (kalau
  // dokter membuka ulang order yg sama utk koreksi), reuse endpoint yg
  // sama dgn ModalHasilRadiologi.tsx.
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/radiologi/permintaan/${encodeURIComponent(noorder)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail permintaan USG');
        setExams((data.pemeriksaan || []).map((e: ExamRow) => ({ kd_jenis_prw: e.kd_jenis_prw, nm_perawatan: e.nm_perawatan })));
        if (data.hasil_terakhir) setHasil(data.hasil_terakhir);
        if (data.sudah_ada_hasil && data.petugas_nip_terakhir) {
          setPetugasNip(data.petugas_nip_terakhir);
          setPetugasQuery(data.petugas_nama_terakhir || data.petugas_nip_terakhir);
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
      } finally {
        setLoading(false);
      }
    })();
    const now = new Date();
    setTglPeriksa(todayStr());
    setJamPeriksa(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  }, [noorder]);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(petugasQuery)}`);
      if (res.ok) setPetugasList(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [petugasQuery]);

  // Petugas default = user yg sedang login, padanan KdPtg.setText
  // (akses.getkode()) di DlgPeriksaRadiologi.java — cari by nip persis,
  // TAPI jangan timpa kalau sudah terisi dari hasil_terakhir di atas.
  React.useEffect(() => {
    if (petugasNip) return;
    const currentNip = getCurrentUserNip();
    if (!currentNip) return;
    (async () => {
      const res = await fetch(`/api/petugas?search=${encodeURIComponent(currentNip)}`);
      if (!res.ok) return;
      const list: { nip: string; nama: string }[] = await res.json();
      const match = list.find((p) => p.nip === currentNip);
      if (match) {
        setPetugasNip(match.nip);
        setPetugasQuery(match.nama);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!petugasNip) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Pilih Petugas dulu' });
      return;
    }
    if (!patient.kd_dokter) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Dokter poliklinik pasien ini belum diketahui — periksa data kunjungan.' });
      return;
    }
    if (!hasil.trim()) {
      Swal.fire({ icon: 'warning', title: 'Peringatan', text: 'Isi Hasil Pemeriksaan dulu' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/radiologi/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noorder,
          no_rawat: patient.no_rawat,
          nip: petugasNip,
          kd_dokter: patient.kd_dokter,
          dokter_perujuk: patient.kd_dokter,
          pemeriksaan: exams.map((e) => ({ kd_jenis_prw: e.kd_jenis_prw })),
          hasil: hasil.trim(),
          tgl: otomatisJam ? '' : tglPeriksa,
          jam: otomatisJam ? '' : jamPeriksa,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan hasil pemeriksaan USG');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Hasil pemeriksaan USG berhasil disimpan', timer: 2000, showConfirmButton: false });
      onSaved();
      handleClose();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 30, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 4,
    fontSize: 12, boxSizing: 'border-box', outline: 'none',
  };
  const pillReadOnly: React.CSSProperties = { ...inputStyle, background: '#f3f4f6', color: '#374151' };
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxHeight: 200, overflowY: 'auto', zIndex: 1100, marginTop: 4,
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
        onClick={handleClose}
      >
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '50vw', maxWidth: '90vw',
            background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — breadcrumb pasien + close button bulat */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#000000', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1AB1E5" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span style={{ fontWeight: 600 }}>Input Hasil Pemeriksaan USG</span>
              {[patient?.no_rawat, patient?.no_rkm_medis, patient?.nm_pasien, patient?.umur]
                .filter(Boolean)
                .map((v, i) => (
                  <React.Fragment key={i}>
                    <span>|</span><span>{v}</span>
                  </React.Fragment>
                ))}
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
                background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0,
              }}
            >
              &times;
            </button>
          </div>

          {/* Body — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 16 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ marginTop: 12 }}>Memuat data...</p>
              </div>
            ) : (
              <>
                {/* Dokter P.J. & Dokter Perujuk — read-only, terkunci ke
                    dokter poliklinik pasien ini (patient.kd_dokter/nm_dokter). */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>Dokter Penanggung Jawab</label>
                    <input readOnly value={patient.nm_dokter || '-'} style={pillReadOnly} title="Otomatis dokter poliklinik pasien ini" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>Dokter Perujuk</label>
                    <input readOnly value={patient.nm_dokter || '-'} style={pillReadOnly} title="Otomatis dokter poliklinik pasien ini" />
                  </div>
                </div>

                {/* Petugas & Tanggal/Jam */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
                      Petugas <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={petugasQuery}
                      onChange={(e) => { setPetugasQuery(e.target.value); setPetugasNip(''); setShowPetugasDropdown(true); }}
                      onFocus={() => setShowPetugasDropdown(true)}
                      onBlur={() => setTimeout(() => setShowPetugasDropdown(false), 200)}
                      placeholder="Cari nama petugas..."
                      style={inputStyle}
                    />
                    {showPetugasDropdown && petugasList.length > 0 && (
                      <div style={dropdownStyle}>
                        {petugasList.map((p, i) => (
                          <div
                            key={p.nip}
                            onClick={() => { setPetugasNip(p.nip); setPetugasQuery(p.nama); setShowPetugasDropdown(false); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: i < petugasList.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                          >{p.nama} ({p.nip})</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>Tanggal / Jam</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="date" disabled={otomatisJam} value={tglPeriksa} onChange={(e) => setTglPeriksa(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      <input type="time" disabled={otomatisJam} value={jamPeriksa} onChange={(e) => setJamPeriksa(e.target.value)} style={{ ...inputStyle, width: 90 }} />
                      <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={otomatisJam} onChange={(e) => setOtomatisJam(e.target.checked)} />
                        Otomatis
                      </label>
                    </div>
                  </div>
                </div>

                {/* Tabel Pemeriksaan */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>Pemeriksaan</label>
                  <div style={{ border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', fontSize: 12, color: '#374151' }}>
                      <div style={{ width: 90, padding: '0 8px', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>Kode</div>
                      <div style={{ flex: 1, padding: '0 8px' }}>Nama Pemeriksaan</div>
                    </div>
                    {exams.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Tidak ada pemeriksaan pada permintaan ini</div>
                    ) : exams.map((e, idx) => (
                      <div key={e.kd_jenis_prw} style={{ display: 'flex', alignItems: 'center', height: 28, boxSizing: 'border-box', borderBottom: idx < exams.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ width: 90, padding: '0 8px', fontSize: 12, color: '#111827', flexShrink: 0, borderRight: '1px solid #f3f4f6' }}>{e.kd_jenis_prw}</div>
                        <div style={{ flex: 1, padding: '0 8px', fontSize: 12, color: '#111827' }}>{e.nm_perawatan}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hasil Pemeriksaan */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 200 }}>
                  <label style={{ fontSize: 12, fontWeight: 400, marginBottom: 6, display: 'block', color: '#374151' }}>
                    Hasil Pemeriksaan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={hasil}
                    onChange={(e) => setHasil(e.target.value)}
                    placeholder="Tulis hasil bacaan/expertise USG..."
                    style={{ flex: 1, minHeight: 200, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer — sticky, tombol Simpan full-width */}
          <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || loading}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 4, border: 'none', background: (saving || loading) ? '#9ca3af' : '#1AB1E5', color: '#fff', cursor: (saving || loading) ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 400 }}
              onMouseOver={(e) => { if (!saving && !loading) e.currentTarget.style.background = '#0891B2'; }}
              onMouseOut={(e) => { if (!saving && !loading) e.currentTarget.style.background = '#1AB1E5'; }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Hasil Pemeriksaan USG'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </>
  );
};
