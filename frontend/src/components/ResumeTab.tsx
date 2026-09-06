import React from 'react';
import Swal from 'sweetalert2';
import { ModalInputResume, ResumeRanap } from './ModalInputResume';

type ResumeTabProps = {
  patient: any;
};

const empty: ResumeRanap = {
  kd_dokter: '', nm_dokter: '',
  kd_dokter_pengirim: '', nm_dokter_pengirim: '',
  diagnosa_awal: '', alasan: '', keluhan_utama: '',
  pemeriksaan_fisik: '', pemeriksaan_penunjang: '', hasil_laborat: '',
  obat_di_rs: '',
  diagnosa_utama: '', kd_diagnosa_utama: '',
  diagnosa_sekunder: '', kd_diagnosa_sekunder: '',
  diagnosa_sekunder2: '', kd_diagnosa_sekunder2: '',
  diagnosa_sekunder3: '', kd_diagnosa_sekunder3: '',
  diagnosa_sekunder4: '', kd_diagnosa_sekunder4: '',
  diagnosa_sekunder5: '', kd_diagnosa_sekunder5: '',
  prosedur_utama: '', kd_prosedur_utama: '',
  prosedur_sekunder: '', kd_prosedur_sekunder: '',
  prosedur_sekunder2: '', kd_prosedur_sekunder2: '',
  prosedur_sekunder3: '', kd_prosedur_sekunder3: '',
  prosedur_sekunder4: '', kd_prosedur_sekunder4: '',
  prosedur_sekunder5: '', kd_prosedur_sekunder5: '',
  konsul_dokter: '', edukasi: '',
  cara_keluar: '', ket_keluar: '',
  keadaan: '', ket_keadaan: '',
  obat_pulang: '',
};

export const ResumeTab: React.FC<ResumeTabProps> = ({ patient }) => {
  const [form, setForm] = React.useState<ResumeRanap>(empty);
  const [loading, setLoading] = React.useState(false);
  const [exists, setExists] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);

  const fetchResume = async () => {
    setLoading(true);
    // DPJP (dpjp_ranap) dan Dokter Pengirim/IGD (reg_periksa.kd_dokter)
    // sumbernya BEDA TABEL — sebelumnya field "Dokter IGD" salah pakai
    // patient.kd_dokter/nm_dokter yg ternyata isinya DPJP juga (lihat
    // getRawatInapList di backend), jadi sering kosong krn tidak semua
    // pasien sudah punya baris dpjp_ranap. Sekarang fetch masing2 dari
    // endpoint yg benar.
    const [dpjp, dokterPengirim] = await Promise.all([
      fetch(`/api/dpjp-ranap/${patient.no_rawat}`)
        .then((res) => (res.ok ? res.json() : { kd_dokter: '', nm_dokter: '' }))
        .catch(() => ({ kd_dokter: '', nm_dokter: '' })),
      fetch(`/api/dokter-pengirim/${patient.no_rawat}`)
        .then((res) => (res.ok ? res.json() : { kd_dokter: '', nm_dokter: '' }))
        .catch(() => ({ kd_dokter: '', nm_dokter: '' })),
    ]);
    try {
      const res = await fetch(`/api/resume/${patient.no_rawat}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.resume_pasien_ranap) {
        setForm({
          ...empty,
          ...data.resume_pasien_ranap,
          kd_dokter_pengirim: data.resume_pasien_ranap.kd_dokter_pengirim || dokterPengirim.kd_dokter || '',
          nm_dokter_pengirim: data.resume_pasien_ranap.nm_dokter_pengirim || dokterPengirim.nm_dokter || '',
          kd_dokter: data.resume_pasien_ranap.kd_dokter || dpjp.kd_dokter || '',
          nm_dokter: data.resume_pasien_ranap.nm_dokter || dpjp.nm_dokter || '',
          diagnosa_awal: data.resume_pasien_ranap.diagnosa_awal || patient.diagnosa_awal || '',
        });
        setExists(true);
      } else {
        setForm({
          ...empty,
          kd_dokter_pengirim: dokterPengirim.kd_dokter || '', nm_dokter_pengirim: dokterPengirim.nm_dokter || '',
          kd_dokter: dpjp.kd_dokter || '', nm_dokter: dpjp.nm_dokter || '',
          diagnosa_awal: patient.diagnosa_awal || '',
        });
        setExists(false);
      }
    } catch {
      setForm({
        ...empty,
        kd_dokter_pengirim: dokterPengirim.kd_dokter || '', nm_dokter_pengirim: dokterPengirim.nm_dokter || '',
        kd_dokter: dpjp.kd_dokter || '', nm_dokter: dpjp.nm_dokter || '',
        diagnosa_awal: patient.diagnosa_awal || '',
      });
      setExists(false);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchResume();
  }, [patient.no_rawat]);

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Hapus Resume?',
      text: 'Data resume yang sudah disimpan akan dihapus permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Batal',
      confirmButtonText: 'Ya, Hapus',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/resume-ranap?no_rawat=${encodeURIComponent(patient.no_rawat)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menghapus');
      await fetchResume();
      Swal.fire({ icon: 'success', title: 'Resume dihapus', timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: e.message });
    }
  };

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
      Memuat data resume...
    </div>
  );

  return (
    <div>

      {/* Tombol Buat/Edit Resume — flat radius 0, PERSIS gaya "+ Input
          Resep" di ResepTab.tsx, per permintaan user. */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-start' }}>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {exists ? 'Edit Resume' : 'Buat Resume'}
        </button>
      </div>

      {/* Riwayat Resume */}
      {exists && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1AB1E5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Resume Tersimpan
            </div>
            <button
              type="button"
              onClick={handleDelete}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Hapus
            </button>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

            {/* Dokter */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <RiwayatItem label="Dokter Pengirim" value={`${form.kd_dokter_pengirim ? `[${form.kd_dokter_pengirim}] ` : ''}${form.nm_dokter_pengirim}`} />
              <RiwayatItem label="Dokter PJ" value={`${form.kd_dokter ? `[${form.kd_dokter}] ` : ''}${form.nm_dokter}`} />
            </div>

            {/* Anamnesis */}
            {(form.diagnosa_awal || form.alasan || form.keluhan_utama) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {form.diagnosa_awal && <RiwayatItem label="Diagnosa Awal" value={form.diagnosa_awal} />}
                {form.alasan && <RiwayatItem label="Alasan Masuk RS" value={form.alasan} />}
                {form.keluhan_utama && <RiwayatItem label="Keluhan Utama" value={form.keluhan_utama} span2 />}
              </div>
            )}

            {/* Pemeriksaan */}
            {(form.pemeriksaan_fisik || form.pemeriksaan_penunjang || form.hasil_laborat || form.obat_di_rs) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {form.pemeriksaan_fisik && <RiwayatItem label="Pemeriksaan Fisik" value={form.pemeriksaan_fisik} />}
                {form.pemeriksaan_penunjang && <RiwayatItem label="Pemeriksaan Penunjang" value={form.pemeriksaan_penunjang} />}
                {form.hasil_laborat && <RiwayatItem label="Hasil Laboratorium" value={form.hasil_laborat} span2 />}
                {form.obat_di_rs && <RiwayatItem label="Obat di RS" value={form.obat_di_rs} span2 />}
              </div>
            )}

            {/* Diagnosa */}
            {[
              ['Diagnosa Utama', form.diagnosa_utama, form.kd_diagnosa_utama],
              ['Diagnosa Sekunder 1', form.diagnosa_sekunder, form.kd_diagnosa_sekunder],
              ['Diagnosa Sekunder 2', form.diagnosa_sekunder2, form.kd_diagnosa_sekunder2],
              ['Diagnosa Sekunder 3', form.diagnosa_sekunder3, form.kd_diagnosa_sekunder3],
              ['Diagnosa Sekunder 4', form.diagnosa_sekunder4, form.kd_diagnosa_sekunder4],
              ['Diagnosa Sekunder 5', form.diagnosa_sekunder5, form.kd_diagnosa_sekunder5],
            ].some(([, v]) => v) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Diagnosa</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Diagnosa Utama', form.diagnosa_utama, form.kd_diagnosa_utama],
                    ['Sekunder 1', form.diagnosa_sekunder, form.kd_diagnosa_sekunder],
                    ['Sekunder 2', form.diagnosa_sekunder2, form.kd_diagnosa_sekunder2],
                    ['Sekunder 3', form.diagnosa_sekunder3, form.kd_diagnosa_sekunder3],
                    ['Sekunder 4', form.diagnosa_sekunder4, form.kd_diagnosa_sekunder4],
                    ['Sekunder 5', form.diagnosa_sekunder5, form.kd_diagnosa_sekunder5],
                  ].filter(([, v]) => v).map(([label, nama, kode]) => (
                    <div key={label as string} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: '#6b7280', width: 120, flexShrink: 0, fontSize: 12 }}>{label as string}</span>
                      <span style={{ color: '#111827' }}>{nama as string}</span>
                      {kode && <span style={{ color: '#7c3aed', fontSize: 12, background: '#f5f3ff', padding: '1px 6px', borderRadius: 4 }}>{kode as string}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prosedur */}
            {[
              form.prosedur_utama, form.prosedur_sekunder, form.prosedur_sekunder2,
              form.prosedur_sekunder3, form.prosedur_sekunder4, form.prosedur_sekunder5,
            ].some(v => v) && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Prosedur / Tindakan</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Prosedur Utama', form.prosedur_utama, form.kd_prosedur_utama],
                    ['Sekunder 1', form.prosedur_sekunder, form.kd_prosedur_sekunder],
                    ['Sekunder 2', form.prosedur_sekunder2, form.kd_prosedur_sekunder2],
                    ['Sekunder 3', form.prosedur_sekunder3, form.kd_prosedur_sekunder3],
                    ['Sekunder 4', form.prosedur_sekunder4, form.kd_prosedur_sekunder4],
                    ['Sekunder 5', form.prosedur_sekunder5, form.kd_prosedur_sekunder5],
                  ].filter(([, v]) => v).map(([label, nama, kode]) => (
                    <div key={label as string} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: '#6b7280', width: 120, flexShrink: 0, fontSize: 12 }}>{label as string}</span>
                      <span style={{ color: '#111827' }}>{nama as string}</span>
                      {kode && <span style={{ color: '#0891b2', fontSize: 12, background: '#e0f2fe', padding: '1px 6px', borderRadius: 4 }}>{kode as string}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Konsultasi, Edukasi, Kondisi Keluar */}
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {form.konsul_dokter && <RiwayatItem label="Konsultasi Dokter" value={form.konsul_dokter} />}
              {form.edukasi && <RiwayatItem label="Edukasi" value={form.edukasi} />}
              {form.cara_keluar && <RiwayatItem label="Cara Keluar" value={form.cara_keluar} />}
              {form.ket_keluar && <RiwayatItem label="Keterangan Keluar" value={form.ket_keluar} />}
              {form.keadaan && <RiwayatItem label="Keadaan Pulang" value={form.keadaan} />}
              {form.ket_keadaan && <RiwayatItem label="Keterangan Keadaan" value={form.ket_keadaan} />}
              {form.obat_pulang && <RiwayatItem label="Obat Pulang" value={form.obat_pulang} span2 />}
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Resume */}
      {showModal && (
        <ModalInputResume
          patient={patient}
          initialData={form}
          exists={exists}
          onClose={() => setShowModal(false)}
          onSaved={fetchResume}
        />
      )}
    </div>
  );
};

const RiwayatItem: React.FC<{ label: string; value: string; span2?: boolean }> = ({ label, value, span2 }) => (
  <div style={{ gridColumn: span2 ? 'span 2' : 'span 1' }}>
    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{value || '-'}</div>
  </div>
);
