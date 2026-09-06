import React from 'react';
import Swal from 'sweetalert2';
import { ResepModal } from './ResepModal';

// ResepTab.tsx — tab "Riwayat Permintaan Resep" self-contained (pola sama
// spt LabTab/RadTab/TindakanTab/DiagnosaTab: cukup dikasih `patient`,
// fetch & render sendiri) supaya bisa dipakai ulang di modul IGD tanpa
// menduplikasi/menyentuh kode Resep yg sudah teruji di Pemeriksaan.tsx
// (Rawat Jalan) — endpoint SAMA (/api/resep/*) krn kunjungan IGD sudah
// diperlakukan flavor Ralan di seluruh backend. Skrg jg dipakai
// PemeriksaanRanap.tsx lewat prop `isRanap` (endpoint beda,
// /api/resep-ranap/*, tapi bentuk respons sudah disamakan di backend —
// getResepRanap ikut kirim field `status`/`metode_racik`/`kapasitas` spy
// tampilannya PERSIS sama tanpa ResepTab.tsx perlu tau beda flavor).
type ResepTabProps = {
  patient: any;
  isRanap?: boolean;
  // Increment nilai ini dari parent utk otomatis membuka modal "+ Input
  // Resep" (dipakai alur "Lanjutkan Input Resep" stlh simpan SOAP/CPPT).
  // Baseline per no_rawat disimpan di lastHandledSignalByPatient (persist
  // lintas mount/unmount tab), jadi tab-switch manual tanpa signal baru
  // tidak ikut memicu modal terbuka lagi.
  openInputSignal?: number;
  // Dipanggil setiap riwayat resep berubah (simpan/hapus) supaya parent
  // bisa refresh data lain yg terkait (mis. history SOAP/CPPT IGD).
  onResepChanged?: () => void;
  // extraActions — tombol tambahan yg dirender SEJAJAR "+ Input Resep"
  // (mis. "+ Resep Pulang" khusus Ranap di PemeriksaanRanap.tsx), per
  // permintaan user. Opsional — kalau tidak dikasih, cuma "+ Input Resep"
  // sendirian spt biasa (Poli/IGD).
  extraActions?: React.ReactNode;
};

const formatDateTime = (date: string, time: string) => {
  let formattedDate = '';
  let formattedTime = '';

  // Handle ISO 8601 format (2025-12-01T00:00:00+07:00)
  if (date && date.includes('T')) {
    const datePart = date.split('T')[0];
    const [year, month, day] = datePart.split('-');
    formattedDate = `${day}/${month}/${year}`;

    if (!time || time.length === 0) {
      const timePart = date.split('T')[1];
      if (timePart) {
        const timeOnly = timePart.split('+')[0].split('-')[0].split('Z')[0];
        formattedTime = timeOnly.length === 8 ? timeOnly : `${timeOnly}:00`.substring(0, 8);
      } else {
        formattedTime = '00:00:00';
      }
    } else {
      formattedTime = time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00');
    }
  }
  // Handle YYYY-MM-DD format
  else if (date && date.includes('-') && date.length === 10) {
    const [year, month, day] = date.split('-');
    formattedDate = `${day}/${month}/${year}`;
    formattedTime = time && time.length > 0
      ? (time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00'))
      : '00:00:00';
  }
  // Handle DD/MM/YYYY format (sudah benar)
  else if (date && date.includes('/')) {
    formattedDate = date;
    formattedTime = time && time.length > 0
      ? (time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00'))
      : '00:00:00';
  }
  // Default fallback
  else {
    formattedDate = date || '';
    formattedTime = time && time.length > 0
      ? (time.length === 8 ? time : (time.length === 5 ? `${time}:00` : '00:00:00'))
      : '00:00:00';
  }

  return `${formattedDate} ${formattedTime}`;
};

// lastHandledSignalByPatient — baseline openInputSignal per no_rawat,
// disimpan DI LUAR komponen supaya tetap "ingat" walau ResepTab
// unmount/remount tiap kali user ganti tab (tab "resep" dirender
// conditional `{activeTab==='resep' && <ResepTab/>}`, jadi ref biasa di
// dalam komponen selalu reset ke nilai prop terbaru tiap kali tab
// Resep dibuka kembali — bikin baseline useRef di bawah TIDAK BISA
// bedakan "baru pertama kali dibuka manual" vs "baru saja di-trigger
// bareng tab-switch dari alur Lanjutkan Input Resep").
const lastHandledSignalByPatient: Record<string, number> = {};

export const ResepTab: React.FC<ResepTabProps> = ({ patient, isRanap, openInputSignal, onResepChanged, extraActions }) => {
  const [riwayatResep, setRiwayatResep] = React.useState<any[]>([]);
  const [loadingRiwayatResep, setLoadingRiwayatResep] = React.useState(false);
  const [showResepModal, setShowResepModal] = React.useState(false);
  const [editingResep, setEditingResep] = React.useState<{ no_resep: string; items: any[]; racikan?: any[] } | null>(null);

  const fetchRiwayatResep = React.useCallback(async () => {
    setLoadingRiwayatResep(true);
    try {
      const url = isRanap
        ? `/api/resep-ranap/list?no_rawat=${encodeURIComponent(patient.no_rawat)}`
        : `/api/resep/history/${encodeURIComponent(patient.no_rkm_medis)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch riwayat resep');
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setRiwayatResep(isRanap ? list : list.filter((r: any) => r.no_rawat === patient.no_rawat));
    } catch (err) {
      console.error('Error fetching riwayat resep:', err);
      setRiwayatResep([]);
    } finally {
      setLoadingRiwayatResep(false);
    }
  }, [patient.no_rkm_medis, patient.no_rawat, isRanap]);

  React.useEffect(() => { fetchRiwayatResep(); }, [fetchRiwayatResep]);

  // Buka modal input resep saat parent menaikkan openInputSignal — baseline
  // dibaca dari lastHandledSignalByPatient (persist lintas mount/unmount,
  // lihat komentar di atas), bukan dari useRef biasa, supaya kombinasi
  // "pindah tab + naikkan signal" yg terjadi di render yg sama (alur
  // Lanjutkan Input Resep) tetap kedetek sbg perubahan begitu ResepTab
  // baru mount, tapi tab-switch manual belakangan (signal tdk berubah)
  // tidak memicu modal kebuka lagi.
  React.useEffect(() => {
    const key = patient?.no_rawat || '';
    const prev = lastHandledSignalByPatient[key] ?? 0;
    if (openInputSignal !== undefined && openInputSignal !== prev) {
      lastHandledSignalByPatient[key] = openInputSignal;
      setEditingResep(null);
      setShowResepModal(true);
    }
  }, [openInputSignal, patient?.no_rawat]);

  const handleDeleteResep = async (noResep: string) => {
    const resepToDelete = riwayatResep.find(r => r.no_resep === noResep);
    const status = resepToDelete?.status?.toString().trim().toLowerCase() || '';

    if (!resepToDelete || status !== 'belum') {
      await Swal.fire({
        icon: 'warning',
        title: 'Tidak Dapat Dihapus',
        text: status === 'sudah'
          ? 'Resep sudah tervalidasi, tidak dapat dihapus'
          : 'Resep tidak dapat dihapus',
        confirmButtonColor: '#6b7280'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus Resep?',
      text: `Apakah Anda yakin ingin menghapus resep ${noResep}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const url = isRanap
          ? `/api/resep-ranap?no_resep=${encodeURIComponent(noResep)}`
          : `/api/resep/${encodeURIComponent(noResep)}`;
        const response = await fetch(url, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || 'Gagal menghapus resep');

        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: data.message || 'Resep berhasil dihapus',
          timer: 2000,
          showConfirmButton: false
        });

        await fetchRiwayatResep();
        onResepChanged?.();
      } catch (err: any) {
        console.error('Error deleting resep:', err);
        Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus resep' });
      }
    }
  };

  return (
    <>
      {/* Tombol rata kiri, ukuran/gaya PERSIS "Input Awal Medis" (padding
          8px 16px, radius 0, ikon +) — per permintaan user, ganti dari
          versi lama (rata kanan sebaris judul, radius 4). extraActions
          (mis. "+ Resep Pulang" Ranap) dirender sejajar di sebelahnya. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setEditingResep(null); setShowResepModal(true); }}
          style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#0891B2'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#1AB1E5'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Input Resep
        </button>
        {extraActions}
      </div>

      {loadingRiwayatResep && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Memuat data resep...</div>
      )}

      {!loadingRiwayatResep && riwayatResep.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Permintaan Resep</div>
          <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada permintaan resep hari ini untuk pasien ini.</div>
        </div>
      )}

      {!loadingRiwayatResep && riwayatResep.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {riwayatResep.map((resep, index) => {
            const belum = resep.status?.toString().trim().toLowerCase() === 'belum';
            const nonRacikan = resep.non_racikan || [];
            const racikan = resep.racikan || [];
            return (
              <div key={index} style={{ background: '#fff', borderRadius: 0, border: `1px solid ${belum ? '#e5e7eb' : '#d1fae5'}`, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>{resep.no_resep || '-'}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{formatDateTime(resep.tgl_peresepan, resep.jam_peresepan || '')}</span>
                    {resep.nm_dokter && <span style={{ fontSize: 12, color: '#7c3aed' }}>{resep.nm_dokter}</span>}
                    {resep.status === 'retur' && (
                      <span style={{ fontSize: 12, fontWeight: 400, padding: '2px 8px', borderRadius: 0, background: '#fee2e2', color: '#991b1b' }}>Retur</span>
                    )}
                    <span style={{
                      fontSize: 12, fontWeight: 400, padding: '2px 8px', borderRadius: 0,
                      background: belum ? '#fef3c7' : '#d1fae5',
                      color: belum ? '#92400e' : '#065f46'
                    }}>
                      {belum ? 'Belum Terlayani' : 'Sudah Terlayani'}
                    </span>
                  </div>
                  {belum && (
                    <div style={{ display: 'flex', gap: 0 }}>
                      <button
                        onClick={() => {
                          setEditingResep({
                            no_resep: resep.no_resep,
                            items: nonRacikan.map((it: any) => ({ ...it, aturan: it.aturan_pakai })),
                            racikan,
                          });
                          setShowResepModal(true);
                        }}
                        style={{ padding: '4px 10px', borderRadius: 0, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 400 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteResep(resep.no_resep)}
                        style={{ padding: '4px 10px', borderRadius: 0, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 400 }}
                      >
                        Batalkan
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ padding: '10px 16px' }}>
                  {nonRacikan.length > 0 && (
                    <div style={{ marginBottom: racikan.length > 0 ? 10 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 400, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Non Racikan</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 160 }}>Aturan Pakai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nonRacikan.map((item: any, j: number) => (
                            <tr key={j}>
                              <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 400, color: '#374151' }}>{item.nama_brng || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{item.jml || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#7c3aed' }}>{item.aturan_pakai || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {racikan.length > 0 && racikan.map((rack: any, ri: number) => (
                    <div key={ri} style={{ marginTop: ri > 0 ? 8 : 0 }}>
                      {/* Garis pemisah selebar CARD (bukan cuma selebar
                          konten) — margin negatif nutupin padding 16px
                          kiri/kanan parent (".padding: '10px 16px'") biar
                          border-top-nya nyampe ke tepi card. */}
                      <div style={{ marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 400, color: '#7c3aed', marginBottom: 4, marginLeft: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Racikan — {rack.nama_racik || `R${ri + 1}`}
                          {rack.metode_racik && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.metode_racik}</span>}
                          {rack.aturan_pakai && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.aturan_pakai}</span>}
                          {rack.jml_dr > 0 && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.jml_dr} bungkus</span>}
                        </div>
                        <table style={{ width: 'calc(100% - 20px)', marginLeft: 20, borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f9fafb' }}>
                              <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                              <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Kps</th>
                              <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 400, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(rack.detail || []).map((det: any, di: number) => (
                              <tr key={di}>
                                <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 400, color: '#374151' }}>{det.nama_brng || '-'}</td>
                                <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{det.kapasitas || '-'}</td>
                                <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{det.jml || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showResepModal && (
        <ResepModal
          patient={patient}
          isRanap={isRanap}
          editResep={editingResep || undefined}
          onClose={() => { setShowResepModal(false); setEditingResep(null); }}
          onResepSaved={async () => {
            setShowResepModal(false);
            setEditingResep(null);
            await fetchRiwayatResep();
            onResepChanged?.();
            await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Resep berhasil disimpan', timer: 2000, showConfirmButton: false });
          }}
        />
      )}
    </>
  );
};
