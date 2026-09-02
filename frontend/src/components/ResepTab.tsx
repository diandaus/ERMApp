import React from 'react';
import Swal from 'sweetalert2';
import { ResepModal } from './ResepModal';

// ResepTab.tsx — tab "Riwayat Permintaan Resep" self-contained (pola sama
// spt LabTab/RadTab/TindakanTab/DiagnosaTab: cukup dikasih `patient`,
// fetch & render sendiri) supaya bisa dipakai ulang di modul IGD tanpa
// menduplikasi/menyentuh kode Resep yg sudah teruji di Pemeriksaan.tsx
// (Rawat Jalan) — endpoint SAMA (/api/resep/*) krn kunjungan IGD sudah
// diperlakukan flavor Ralan di seluruh backend.
type ResepTabProps = {
  patient: any;
  // Increment nilai ini dari parent utk otomatis membuka modal "+ Input
  // Resep" (dipakai alur "Lanjutkan Input Resep" stlh simpan SOAP/CPPT).
  // Perubahan pertama saat mount TIDAK memicu modal (lihat prevSignalRef).
  openInputSignal?: number;
  // Dipanggil setiap riwayat resep berubah (simpan/hapus) supaya parent
  // bisa refresh data lain yg terkait (mis. history SOAP/CPPT IGD).
  onResepChanged?: () => void;
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

export const ResepTab: React.FC<ResepTabProps> = ({ patient, openInputSignal, onResepChanged }) => {
  const [riwayatResep, setRiwayatResep] = React.useState<any[]>([]);
  const [loadingRiwayatResep, setLoadingRiwayatResep] = React.useState(false);
  const [showResepModal, setShowResepModal] = React.useState(false);
  const [editingResep, setEditingResep] = React.useState<{ no_resep: string; items: any[]; racikan?: any[] } | null>(null);

  const fetchRiwayatResep = React.useCallback(async () => {
    setLoadingRiwayatResep(true);
    try {
      const response = await fetch(`/api/resep/history/${encodeURIComponent(patient.no_rkm_medis)}`);
      if (!response.ok) throw new Error('Failed to fetch riwayat resep');
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setRiwayatResep(list.filter((r: any) => r.no_rawat === patient.no_rawat));
    } catch (err) {
      console.error('Error fetching riwayat resep:', err);
      setRiwayatResep([]);
    } finally {
      setLoadingRiwayatResep(false);
    }
  }, [patient.no_rkm_medis, patient.no_rawat]);

  React.useEffect(() => { fetchRiwayatResep(); }, [fetchRiwayatResep]);

  // Buka modal input resep saat parent menaikkan openInputSignal — dilewati
  // pada render pertama supaya tidak auto-buka begitu tab dimount.
  const prevSignalRef = React.useRef(openInputSignal);
  React.useEffect(() => {
    if (openInputSignal !== undefined && openInputSignal !== prevSignalRef.current) {
      prevSignalRef.current = openInputSignal;
      setEditingResep(null);
      setShowResepModal(true);
    }
  }, [openInputSignal]);

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
        const response = await fetch(`/api/resep/${encodeURIComponent(noResep)}`, { method: 'DELETE' });
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 400, color: '#374151' }}>Riwayat Permintaan Resep</h4>
        <button
          onClick={() => { setEditingResep(null); setShowResepModal(true); }}
          style={{ padding: '10px 20px', borderRadius: 4, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          + Input Resep
        </button>
      </div>

      {loadingRiwayatResep && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Memuat data resep...</div>
      )}

      {!loadingRiwayatResep && riwayatResep.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          Belum ada permintaan resep hari ini untuk pasien ini
        </div>
      )}

      {!loadingRiwayatResep && riwayatResep.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {riwayatResep.map((resep, index) => {
            const belum = resep.status?.toString().trim().toLowerCase() === 'belum';
            const nonRacikan = resep.non_racikan || [];
            const racikan = resep.racikan || [];
            return (
              <div key={index} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${belum ? '#e5e7eb' : '#d1fae5'}`, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: belum ? '#f9fafb' : '#f0fdf4', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{resep.no_resep || '-'}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{formatDateTime(resep.tgl_peresepan, resep.jam_peresepan || '')}</span>
                    {resep.nm_dokter && <span style={{ fontSize: 13, color: '#7c3aed' }}>{resep.nm_dokter}</span>}
                    {resep.status === 'retur' && (
                      <span style={{ fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: '#fee2e2', color: '#991b1b' }}>Retur</span>
                    )}
                    <span style={{
                      fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                      background: belum ? '#fef3c7' : '#d1fae5',
                      color: belum ? '#92400e' : '#065f46'
                    }}>
                      {belum ? 'Belum Terlayani' : 'Sudah Terlayani'}
                    </span>
                  </div>
                  {belum && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          setEditingResep({
                            no_resep: resep.no_resep,
                            items: nonRacikan.map((it: any) => ({ ...it, aturan: it.aturan_pakai })),
                            racikan,
                          });
                          setShowResepModal(true);
                        }}
                        style={{ padding: '4px 10px', borderRadius: 2, border: '1px solid #1AB1E5', background: '#e0f2fe', color: '#1AB1E5', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteResep(resep.no_resep)}
                        style={{ padding: '4px 10px', borderRadius: 2, border: '1px solid #ef4444', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ padding: '10px 16px' }}>
                  {nonRacikan.length > 0 && (
                    <div style={{ marginBottom: racikan.length > 0 ? 10 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Non Racikan</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb', width: 160 }}>Aturan Pakai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nonRacikan.map((item: any, j: number) => (
                            <tr key={j}>
                              <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 500, color: '#374151' }}>{item.nama_brng || '-'}</td>
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Racikan — {rack.nama_racik || `R${ri + 1}`}
                        {rack.metode_racik && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.metode_racik}</span>}
                        {rack.aturan_pakai && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.aturan_pakai}</span>}
                        {rack.jml_dr > 0 && <span style={{ fontWeight: 400, marginLeft: 6 }}>{rack.jml_dr} bungkus</span>}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb' }}>Nama Obat</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb', width: 60 }}>Jml</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rack.detail || []).map((det: any, di: number) => (
                            <tr key={di}>
                              <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', fontWeight: 500, color: '#374151' }}>{det.nama_brng || '-'}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{det.jml || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
