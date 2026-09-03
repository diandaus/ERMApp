import React from 'react';
import Swal from 'sweetalert2';
import { ModalInputTindakan } from './ModalInputTindakan';

type TindakanTabProps = {
  patient: any;
  // isRanap menentukan sumber data: tabel rawat_inap_dr/pr/drpr (endpoint
  // /api/tindakan-ranap/*) kalau true, atau rawat_jl_dr/pr/drpr (endpoint
  // /api/tindakan-ralan/*, /api/tindakan/*) kalau false/undefined. Tanpa
  // ini, komponen selalu membaca & menghapus dari tabel ralan meski
  // dipakai di layar Rawat Inap.
  isRanap?: boolean;
};

// Padanan 3 tabel terpisah DlgRawatJalan.java (tabModeDr, tabModePr,
// tabModeDrPr) — sengaja TIDAK digabung jadi satu tabel supaya kolomnya
// tetap sesuai sumbernya masing-masing (Dokter Yg Menangani vs Petugas Yg
// Menangani + NIP).
const TH_STYLE: React.CSSProperties = { padding: '8px 10px', fontWeight: 400, fontSize: 12, color: '#111827', whiteSpace: 'nowrap' };
const TD_STYLE: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151' };

export const TindakanTab: React.FC<TindakanTabProps> = ({ patient, isRanap }) => {
  const [tindakanDokter, setTindakanDokter] = React.useState<any[]>([]);
  const [tindakanParamedis, setTindakanParamedis] = React.useState<any[]>([]);
  const [tindakanDokterParamedis, setTindakanDokterParamedis] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showInputModal, setShowInputModal] = React.useState(false);

  React.useEffect(() => {
    fetchTindakanList();
  }, [patient.no_rawat, isRanap]);

  const fetchTindakanList = async () => {
    setLoading(true);
    try {
      const base = isRanap ? '/api/tindakan-ranap' : '/api/tindakan-ralan';
      const res = await fetch(`${base}/${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTindakanDokter(Array.isArray(data.tindakan_dokter) ? data.tindakan_dokter : []);
      setTindakanParamedis(Array.isArray(data.tindakan_paramedis) ? data.tindakan_paramedis : []);
      setTindakanDokterParamedis(Array.isArray(data.tindakan_dokter_paramedis) ? data.tindakan_dokter_paramedis : []);
    } catch {
      setTindakanDokter([]);
      setTindakanParamedis([]);
      setTindakanDokterParamedis([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTindakan = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Tindakan?',
      text: `Apakah Anda yakin ingin menghapus tindakan "${item.nm_perawatan}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      let tglPerawatan = item.tgl_perawatan;
      if (tglPerawatan?.includes('T')) tglPerawatan = tglPerawatan.split('T')[0];

      const params = new URLSearchParams({
        no_rawat: patient.no_rawat,
        kd_jenis_prw: item.kd_jenis_prw,
        tgl_perawatan: tglPerawatan,
        jam_rawat: item.jam_rawat,
        kd_dokter: item.kd_dokter,
      });

      const deleteBase = isRanap ? '/api/tindakan-ranap' : '/api/tindakan';
      const res = await fetch(`${deleteBase}/delete?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus tindakan');

      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Tindakan berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchTindakanList();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus tindakan' });
    }
  };

  // Padanan handleDeleteTindakan di atas, tapi utk baris Tindakan Perawat
  // (rawat_jl_pr, kunci nip bukan kd_dokter). item.tgl_perawatan di sini
  // sudah dalam format DD/MM/YYYY (hasil DATE_FORMAT di query paramedis,
  // beda dari tindakan dokter yang formatnya ISO) — perlu dibalik ke
  // YYYY-MM-DD dulu supaya cocok dgn kolom DATE di query DELETE.
  const handleDeleteTindakanPetugas = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Tindakan?',
      text: `Apakah Anda yakin ingin menghapus tindakan "${item.nm_perawatan}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const [d, m, y] = (item.tgl_perawatan || '').split('/');
      const tglPerawatan = d && m && y ? `${y}-${m}-${d}` : item.tgl_perawatan;

      const params = new URLSearchParams({
        no_rawat: patient.no_rawat,
        kd_jenis_prw: item.kd_jenis_prw,
        tgl_perawatan: tglPerawatan,
        jam_rawat: item.jam_rawat,
        nip: item.nip,
      });

      const deleteBase = isRanap ? '/api/tindakan-ranap' : '/api/tindakan';
      const res = await fetch(`${deleteBase}/delete-petugas?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus tindakan');

      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Tindakan berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchTindakanList();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus tindakan' });
    }
  };

  // Padanan handleDeleteTindakanPetugas di atas, tapi utk baris Tindakan
  // Dokter & Perawat (rawat_jl_drpr, kuncinya kd_dokter + nip sekaligus).
  const handleDeleteTindakanDokterPetugas = async (item: any) => {
    const result = await Swal.fire({
      title: 'Hapus Tindakan?',
      text: `Apakah Anda yakin ingin menghapus tindakan "${item.nm_perawatan}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });
    if (!result.isConfirmed) return;
    try {
      const [d, m, y] = (item.tgl_perawatan || '').split('/');
      const tglPerawatan = d && m && y ? `${y}-${m}-${d}` : item.tgl_perawatan;

      const params = new URLSearchParams({
        no_rawat: patient.no_rawat,
        kd_jenis_prw: item.kd_jenis_prw,
        tgl_perawatan: tglPerawatan,
        jam_rawat: item.jam_rawat,
        kd_dokter: item.kd_dokter,
        nip: item.nip,
      });

      const deleteBase = isRanap ? '/api/tindakan-ranap' : '/api/tindakan';
      const res = await fetch(`${deleteBase}/delete-dokter-petugas?${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus tindakan');

      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Tindakan berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchTindakanList();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus tindakan' });
    }
  };

  const formatDateTime = (tgl: string, jam: string) => {
    if (!tgl || tgl === '0000-00-00') return '-';
    let date = '';
    if (tgl.includes('T')) {
      const d = new Date(tgl);
      date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } else if (tgl.includes('-') && tgl.length >= 10) {
      const [y, m, d] = tgl.split('-');
      date = `${d.substring(0, 2)}/${m}/${y}`;
    } else {
      date = tgl;
    }
    return jam && jam !== '00:00:00' ? `${date} ${jam}` : date;
  };

  const formatRupiah = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const hasAny = tindakanDokter.length > 0 || tindakanParamedis.length > 0 || tindakanDokterParamedis.length > 0;

  return (
    <div>

      {/* Tombol Input Tindakan — rata kiri, ukuran/gaya PERSIS "Input
          Resep" di ResepTab.tsx (padding 8px 16px, radius 0, fontSize 13)
          — per permintaan user, ganti dari versi lama (rata kanan, radius
          4, lebih besar). */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowInputModal(true)}
          style={{ padding: '8px 16px', borderRadius: 0, border: 'none', background: '#1AB1E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#0891B2'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#1AB1E5'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Input Tindakan
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat riwayat...</p>
        </div>
      )}

      {!loading && !hasAny && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Riwayat Tindakan</div>
          <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada riwayat tindakan untuk pasien ini.</div>
        </div>
      )}

      {!loading && hasAny && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Tindakan Dokter — padanan tabModeDr */}
          {tindakanDokter.length > 0 && (
            <div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        {['No.', 'Perawatan/Tindakan', 'Biaya', 'Aksi'].map((h) => (
                          <th key={h} style={{ ...TH_STYLE, textAlign: h === 'Biaya' ? 'right' : h === 'Aksi' ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tindakanDokter.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                          <td style={TD_STYLE}>{idx + 1}</td>
                          <td style={{ ...TD_STYLE, color: '#111827', fontWeight: 400 }}>{item.nm_perawatan}</td>
                          <td style={{ ...TD_STYLE, textAlign: 'right', color: '#111827', fontWeight: 400, whiteSpace: 'nowrap' }}>{formatRupiah(item.biaya_rawat || 0)}</td>
                          <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteTindakan(item)}
                              style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                              title="Hapus Tindakan"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tindakan Perawat — padanan tabModePr */}
          {tindakanParamedis.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 400, color: '#374151', marginBottom: 8 }}>Tindakan Perawat</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        {['No.', 'Perawatan/Tindakan', 'Petugas Yg Menangani', 'Biaya', 'Aksi'].map((h) => (
                          <th key={h} style={{ ...TH_STYLE, textAlign: h === 'Biaya' ? 'right' : h === 'Aksi' ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tindakanParamedis.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                          <td style={TD_STYLE}>{idx + 1}</td>
                          <td style={{ ...TD_STYLE, color: '#111827', fontWeight: 400 }}>{item.nm_perawatan}</td>
                          <td style={TD_STYLE}>{item.nama_paramedis || '-'}</td>
                          <td style={{ ...TD_STYLE, textAlign: 'right', color: '#111827', fontWeight: 400, whiteSpace: 'nowrap' }}>{formatRupiah(item.biaya_rawat || 0)}</td>
                          <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteTindakanPetugas(item)}
                              style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                              title="Hapus Tindakan"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tindakan Dokter & Perawat — padanan tabModeDrPr */}
          {tindakanDokterParamedis.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 400, color: '#374151', marginBottom: 8 }}>Tindakan Dokter &amp; Perawat</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#eee' }}>
                        {['No.', 'Perawatan/Tindakan', 'Petugas Yg Menangani', 'Biaya', 'Aksi'].map((h) => (
                          <th key={h} style={{ ...TH_STYLE, textAlign: h === 'Biaya' ? 'right' : h === 'Aksi' ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tindakanDokterParamedis.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                          <td style={TD_STYLE}>{idx + 1}</td>
                          <td style={{ ...TD_STYLE, color: '#111827', fontWeight: 400 }}>{item.nm_perawatan}</td>
                          <td style={TD_STYLE}>{item.nama_paramedis || '-'}</td>
                          <td style={{ ...TD_STYLE, textAlign: 'right', color: '#111827', fontWeight: 400, whiteSpace: 'nowrap' }}>{formatRupiah(item.biaya_rawat || 0)}</td>
                          <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteTindakanDokterPetugas(item)}
                              style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 0, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                              title="Hapus Tindakan"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Input Tindakan */}
      {showInputModal && (
        <ModalInputTindakan
          patient={patient}
          isRanap={isRanap}
          onClose={() => setShowInputModal(false)}
          onSaved={fetchTindakanList}
        />
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};
