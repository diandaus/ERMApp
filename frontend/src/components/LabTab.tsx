import React from 'react';
import Swal from 'sweetalert2';
import { ModalInputLab } from './ModalInputLab';

type LabTabProps = {
  patient: any;
};

export const LabTab: React.FC<LabTabProps> = ({ patient }) => {
  const [showInputModal, setShowInputModal] = React.useState(false);

  // Blok atas (tombol permintaan + riwayat + judul tabel hasil) dibuat
  // sticky di puncak container scroll (lihat overflow:auto di
  // Pemeriksaan.tsx sekitar activeTab content) supaya tetap terlihat
  // saat tabel hasil lab discroll. Tinggi blok ini diukur via
  // ResizeObserver (bukan angka statis) karena Riwayat Permintaan Lab
  // bisa berubah jumlah kartu, sehingga header <th> tabel hasil bisa
  // ikut ditempel tepat di bawahnya (top: stickyOffset).
  const stickyHeaderRef = React.useRef<HTMLDivElement>(null);
  const [stickyOffset, setStickyOffset] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = stickyHeaderRef.current;
    if (!el) return;
    const update = () => setStickyOffset(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [riwayatPK, setRiwayatPK] = React.useState<any[]>([]);
  const [riwayatPA, setRiwayatPA] = React.useState<any[]>([]);
  const [loadingRiwayatPK, setLoadingRiwayatPK] = React.useState(false);
  const [loadingRiwayatPA, setLoadingRiwayatPA] = React.useState(false);

  const [hasilPeriksa, setHasilPeriksa] = React.useState<any[]>([]);
  const [loadingHasilPeriksa, setLoadingHasilPeriksa] = React.useState(false);

  React.useEffect(() => {
    fetchRiwayatPK();
    fetchRiwayatPA();
    fetchHasilPeriksa();
  }, [patient.no_rawat]);

  const fetchHasilPeriksa = async () => {
    setLoadingHasilPeriksa(true);
    try {
      const noRawat = encodeURIComponent(patient.no_rawat);
      const [resPK, resPA] = await Promise.all([
        fetch(`/api/lab/hasil-detail?kategori=PK&no_rawat=${noRawat}`),
        fetch(`/api/lab/hasil-detail?kategori=PA&no_rawat=${noRawat}`),
      ]);
      const [dataPK, dataPA] = await Promise.all([
        resPK.ok ? resPK.json() : null,
        resPA.ok ? resPA.json() : null,
      ]);
      const gabungan = [
        ...(dataPK?.hasil || []).map((item: any) => ({ ...item, kategori: 'pk' })),
        ...(dataPA?.hasil || []).map((item: any) => ({ ...item, kategori: 'pa' })),
      ];
      gabungan.sort((a, b) => `${b.tgl_periksa} ${b.jam}`.localeCompare(`${a.tgl_periksa} ${a.jam}`));
      setHasilPeriksa(gabungan);
    } catch {
      setHasilPeriksa([]);
    } finally {
      setLoadingHasilPeriksa(false);
    }
  };

  const fetchRiwayatPK = async () => {
    setLoadingRiwayatPK(true);
    try {
      const res = await fetch(`/api/lab/riwayat-pk/${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRiwayatPK(Array.isArray(data) ? data : []);
    } catch {
      setRiwayatPK([]);
    } finally {
      setLoadingRiwayatPK(false);
    }
  };

  const fetchRiwayatPA = async () => {
    setLoadingRiwayatPA(true);
    try {
      const res = await fetch(`/api/lab/riwayat-pa/${encodeURIComponent(patient.no_rawat)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRiwayatPA(Array.isArray(data) ? data : []);
    } catch {
      setRiwayatPA([]);
    } finally {
      setLoadingRiwayatPA(false);
    }
  };

  const handleDeleteLabPK = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Lab PK?',
      text: `Apakah Anda yakin ingin menghapus permintaan ${noorder}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/lab/permintaan-pk/${encodeURIComponent(noorder)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus permintaan lab');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Permintaan lab PK berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchRiwayatPK();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus permintaan lab' });
    }
  };

  const handleDeleteLabPA = async (noorder: string) => {
    const result = await Swal.fire({
      title: 'Hapus Permintaan Lab PA?',
      text: `Apakah Anda yakin ingin menghapus permintaan ${noorder}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`/api/lab/permintaan-pa/${encodeURIComponent(noorder)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menghapus permintaan lab');
      await Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Permintaan lab PA berhasil dihapus', timer: 2000, showConfirmButton: false });
      fetchRiwayatPA();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message || 'Gagal menghapus permintaan lab' });
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

  const handleSaved = () => {
    fetchRiwayatPK();
    fetchRiwayatPA();
  };

  // Sudah keluar hasil? — permintaan_lab.tgl_hasil dikembalikan backend
  // sebagai timestamp Go zero-value "0001-01-01T00:00:00Z" kalau belum ada
  // hasil (kolom DATE kosong '0000-00-00' discan langsung tanpa
  // DATE_FORMAT), atau tanggal asli (mis. "2026-04-15T00:00:00+07:00")
  // begitu hasil disimpan. Dipakai utk menyembunyikan card "Riwayat
  // Permintaan" begitu hasilnya sudah keluar (statusnya bukan pending lagi).
  const sudahAdaHasil = (item: any) => {
    const tgl = item?.tgl_hasil;
    return !!tgl && tgl !== '0000-00-00' && !String(tgl).startsWith('0001-01-01');
  };

  const riwayatPending = React.useMemo(() => [
    ...riwayatPK.map((item) => ({ item, kategori: 'pk' as const })),
    ...riwayatPA.map((item) => ({ item, kategori: 'pa' as const })),
  ].filter(({ item }) => !sudahAdaHasil(item)), [riwayatPK, riwayatPA]);

  return (
    <div>

      {/* Blok sticky: tombol permintaan + riwayat + judul tabel hasil.
          overflow ancestor scroll-nya ada di Pemeriksaan.tsx (tab
          content container overflow:auto) — jangan bungkus blok ini
          atau tabel di bawah dgn overflow:hidden, itu akan membuat
          sticky nempel ke box ini sendiri, bukan ke container scroll
          sungguhan. */}
      <div ref={stickyHeaderRef} style={{ position: 'sticky', top: 0, zIndex: 20, background: '#f9fafb', paddingBottom: 8 }}>
        {/* Tombol Buat Permintaan — rata kiri, ukuran/gaya PERSIS "Input
            Resep" di ResepTab.tsx (padding 8px 16px, radius 0, fontSize
            13) — per permintaan user, ganti dari versi lama (rata kanan,
            radius 4, lebih besar). */}
        <div style={{ marginBottom: 8 }}>
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
            Buat Permintaan Lab
          </button>
        </div>

        {/* Riwayat Permintaan Lab — cuma yang belum ada hasilnya (masih
            "Pending"); begitu hasil sudah keluar, card-nya hilang dari
            sini (tetap bisa dilihat lewat tabel "Hasil Periksa
            Laboratorium" di bawah). */}
        {!loadingRiwayatPK && !loadingRiwayatPA && riwayatPending.length > 0 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {riwayatPending.map(({ item, kategori }, idx) => (
                <RiwayatCard
                  key={idx}
                  item={item}
                  kategori={kategori}
                  onDelete={() => (kategori === 'pk' ? handleDeleteLabPK(item.noorder) : handleDeleteLabPA(item.noorder))}
                  formatDateTime={formatDateTime}
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Loading state — non-sticky, cuma tampil saat fetch awal */}
      {(loadingRiwayatPK || loadingRiwayatPA || loadingHasilPeriksa) && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #f3f4f6', borderTop: '3px solid #1AB1E5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: 12 }}>Memuat data laboratorium...</p>
        </div>
      )}

      {/* Belum ada permintaan Pending ATAUPUN hasil lab tersimpan sama
          sekali — sebelumnya kalau kondisi ini kejadian tab-nya kosong
          melompong tanpa keterangan apa2, sekarang dikasih empty-state. */}
      {!loadingRiwayatPK && !loadingRiwayatPA && !loadingHasilPeriksa && riwayatPending.length === 0 && hasilPeriksa.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 24px', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: 12, background: '#fff' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Belum Ada Data Laboratorium</div>
          <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 320 }}>Belum ada permintaan atau hasil laboratorium untuk pasien ini.</div>
        </div>
      )}

      {/* Hasil Periksa Laboratorium — jarak ke tombol "Buat Permintaan Lab"
          di atasnya dirapatkan (marginTop 16 -> 8), PERSIS gap:16 antara
          tombol & konten di tab Triase/Awal Medis (di sana totalnya cuma
          gap:16 dari flex column, di sini disebar 8+8 lewat marginBottom
          tombol & marginTop tabel krn ada sticky wrapper terpisah). */}
      {!loadingHasilPeriksa && hasilPeriksa.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#eee', color: '#111827' }}>
                  {(['Tanggal', 'Nama Tindakan', 'Hasil', 'Nilai Rujukan', 'Keterangan'] as const).map((h, hi, arr) => (
                    <th
                      key={h}
                      style={{
                        position: 'sticky', top: stickyOffset, zIndex: 19, background: '#eee',
                        padding: '9px 12px', textAlign: h === 'Nama Tindakan' ? 'left' : 'center', fontSize: 12, fontWeight: 400,
                        width: h === 'Tanggal' ? 90 : undefined,
                        borderRight: hi < arr.length - 1 ? '1px solid #d1d5db' : undefined,
                      }}
                    >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasilPeriksa.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr style={{ background: '#f9fafb' }}>
                      <td style={{ padding: '5px 12px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap', verticalAlign: 'top', borderRight: '1px solid #e5e7eb' }}>
                        {formatDateTime(item.tgl_periksa, item.jam)}
                      </td>
                      <td colSpan={4} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 400, color: '#111827' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 0, fontSize: 10, fontWeight: 400, marginRight: 8,
                          background: item.kategori === 'pk' ? '#e0f2fe' : '#f3e8ff',
                          color: item.kategori === 'pk' ? '#0891B2' : '#7c3aed',
                        }}>
                          {item.kategori === 'pk' ? 'LAB PK' : 'LAB PA'}
                        </span>
                        {item.nm_perawatan}
                      </td>
                    </tr>
                    {item.detail?.length > 0 ? item.detail.map((d: any, di: number) => (
                      <tr key={di} style={{ background: '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ borderRight: '1px solid #e5e7eb' }}></td>
                        <td style={{ padding: '5px 12px', fontSize: 12, color: '#374151', borderRight: '1px solid #e5e7eb' }}>{d.pemeriksaan}</td>
                        <td style={{ padding: '5px 12px', fontSize: 12, color: '#374151', textAlign: 'center', fontWeight: 400, borderRight: '1px solid #e5e7eb' }}>{d.nilai || '-'} {d.satuan}</td>
                        <td style={{ padding: '5px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>{d.nilai_rujukan || '-'} {d.satuan}</td>
                        <td style={{ padding: '5px 12px', fontSize: 12, color: '#6b7280', textAlign: 'center' }}>{d.keterangan || '-'}</td>
                      </tr>
                    )) : (
                      <tr style={{ background: '#ffffff' }}>
                        <td></td>
                        <td colSpan={4} style={{ padding: '5px 12px', fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Belum ada hasil detail</td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Input Lab */}
      {showInputModal && (
        <ModalInputLab
          patient={patient}
          onClose={() => setShowInputModal(false)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
};

type RiwayatCardProps = {
  item: any;
  kategori: 'pk' | 'pa';
  onDelete: () => void;
  formatDateTime: (tgl: string, jam: string) => string;
};

const RiwayatCard: React.FC<RiwayatCardProps> = ({ item, kategori, onDelete, formatDateTime }) => (
  <div style={{ border: '1px solid #e5e7eb', borderRadius: 0, padding: 16, background: '#ffffff' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 400, color: '#1AB1E5', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 0, fontSize: 12, fontWeight: 400,
            background: kategori === 'pk' ? '#e0f2fe' : '#f3e8ff',
            color: kategori === 'pk' ? '#0891B2' : '#7c3aed',
          }}>
            {kategori === 'pk' ? 'LAB PK' : 'LAB PA'}
          </span>
          No. Permintaan: {item.noorder}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDateTime(item.tgl_permintaan, item.jam_permintaan)}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{item.nm_dokter || '-'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={onDelete}
            style={{ padding: '6px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 0, fontSize: 12, fontWeight: 400, cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
            title="Batalkan Permintaan"
          >
            Batalkan
          </button>
        </div>
      </div>
    </div>
    <div style={{ fontSize: 12, marginBottom: 8 }}>Diagnosis: {item.diagnosa_klinis}</div>
    {item.informasi_tambahan && (
      <div style={{ fontSize: 12, marginBottom: 8, color: '#6b7280' }}>Info Tambahan: {item.informasi_tambahan}</div>
    )}
    {item.detail_pemeriksaan?.length > 0 && (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 12, fontWeight: 400, marginBottom: 8, color: '#374151' }}>Detail Pemeriksaan:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {item.detail_pemeriksaan.map((d: any, i: number) => (
            <div key={i} style={{ padding: '4px 10px', background: '#e0f2fe', border: '1px solid #1AB1E5', borderRadius: 0, fontSize: 12, color: '#0891B2' }}>
              {d.nm_perawatan || d.kd_jenis_prw}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
