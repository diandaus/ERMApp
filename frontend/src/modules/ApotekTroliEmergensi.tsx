import React from 'react';
import Swal from 'sweetalert2';
import { filterLokasiApotek } from '../utils/apotekLokasi';

// ============================================================================
// APOTEK — Troli Emergensi. TIDAK ADA padanan di Khanza Desktop — fitur
// baru. Troli emergensi (kereta obat darurat per ruangan: IGD/ICU/OK dst)
// direpresentasikan sbg baris `bangsal` biasa (dibuat lewat menu master
// bangsal yang sudah ada) — stoknya otomatis ikut tercatat di gudangbarang
// begitu ada transaksi ke lokasi itu, TIDAK ada mesin stok baru di sini.
//
// Yang baru cuma penanda "lokasi ini troli emergensi" (set_troli_emergensi,
// lihat backend/apotek_troli_emergensi_handler.go) — bisa lebih dari satu
// troli, ditampilkan sbg tab per lokasi (|IGD|OK|ICU|...), difilter di sisi
// klien dari satu fetch gabungan (bukan refetch tiap ganti tab). TIDAK ada
// tab "Semua" (per keputusan user) — selalu tampilkan satu lokasi per
// waktu, default ke lokasi pertama begitu data termuat. TIDAK ada kolom
// Cari — isi troli emergensi selalu sedikit item, sekali pandang cukup.
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const todayStr = new Date().toISOString().slice(0, 10);

type KvOpsi = { kode: string; nama: string };
type TroliLokasi = { kd_bangsal: string; nm_bangsal: string; keterangan: string };
type TroliStokRow = {
  kd_bangsal: string;
  nm_bangsal: string;
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  jenis: string;
  stok: number;
  kadaluarsa: string;
};

export const ApotekTroliEmergensiView: React.FC = () => {
  const [lokasiList, setLokasiList] = React.useState<TroliLokasi[]>([]);
  const [bangsalOptions, setBangsalOptions] = React.useState<KvOpsi[]>([]);
  const [showTambahLokasi, setShowTambahLokasi] = React.useState(false);
  const [kdBangsalBaru, setKdBangsalBaru] = React.useState('');
  const [keteranganBaru, setKeteranganBaru] = React.useState('');
  const [savingLokasi, setSavingLokasi] = React.useState(false);

  const [stokItems, setStokItems] = React.useState<TroliStokRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  // activeTab — kd_bangsal lokasi yang sedang dilihat, difilter di sisi
  // klien dari stokItems (sudah gabungan semua lokasi dari satu fetch,
  // tidak perlu refetch tiap ganti tab). Default ke lokasi pertama.
  const [activeTab, setActiveTab] = React.useState('');

  const fetchLokasi = React.useCallback(async () => {
    try {
      const res = await fetch('/api/apotek/troli-emergensi');
      const data = await res.json();
      setLokasiList(Array.isArray(data) ? data : []);
    } catch {
      setLokasiList([]);
    }
  }, []);

  React.useEffect(() => {
    fetchLokasi();
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBangsalOptions(filterLokasiApotek(Array.isArray(data?.bangsal) ? data.bangsal : [])))
      .catch(() => setBangsalOptions([]));
  }, [fetchLokasi]);

  // Troli emergensi cuma menyimpan sedikit obat (jumlah item selalu kecil,
  // sekali pandang cukup) — tanpa kolom Cari, cukup satu fetch saat
  // dibuka/tab berganti lokasi/lokasi ditambah-hapus.
  const fetchStok = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apotek/troli-emergensi/stok');
      const data = await res.json();
      setStokItems(Array.isArray(data) ? data : []);
    } catch {
      setStokItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStok();
  }, [fetchStok]);

  // Bangsal yang belum ditandai troli — supaya dropdown "+ Tambah Lokasi"
  // tidak menawarkan lokasi yang sudah terdaftar.
  const bangsalBelumTroli = bangsalOptions.filter((b) => !lokasiList.some((l) => l.kd_bangsal === b.kode));

  // Tab aktif tidak lagi valid (lokasinya baru dikeluarkan dari daftar,
  // atau ini load pertama) — pindah ke lokasi pertama yang ada.
  React.useEffect(() => {
    if (!lokasiList.some((l) => l.kd_bangsal === activeTab)) {
      setActiveTab(lokasiList[0]?.kd_bangsal || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lokasiList]);

  const stokTerfilter = stokItems.filter((it) => it.kd_bangsal === activeTab);

  const handleTambahLokasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kdBangsalBaru) {
      Swal.fire({ icon: 'warning', title: 'Pilih lokasi terlebih dahulu' });
      return;
    }
    setSavingLokasi(true);
    try {
      const res = await fetch('/api/apotek/troli-emergensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kd_bangsal: kdBangsalBaru, keterangan: keteranganBaru }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan lokasi');
      setActiveTab(kdBangsalBaru);
      setKdBangsalBaru('');
      setKeteranganBaru('');
      setShowTambahLokasi(false);
      await fetchLokasi();
      fetchStok();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message, timer: 1800, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSavingLokasi(false);
    }
  };

  const handleHapusLokasi = async (lokasi: TroliLokasi) => {
    const confirm = await Swal.fire({
      title: 'Keluarkan dari Daftar Troli Emergensi?',
      html: `<strong>${lokasi.nm_bangsal}</strong> tidak akan ditampilkan lagi di sini. Data bangsal &amp; stoknya TIDAK dihapus.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Keluarkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`/api/apotek/troli-emergensi?kd_bangsal=${encodeURIComponent(lokasi.kd_bangsal)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus lokasi');
      await fetchLokasi();
      fetchStok();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    }
  };

  const tambahLokasiForm = (
    <form onSubmit={handleTambahLokasi} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
      <div style={{ minWidth: 220 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Bangsal/Lokasi</label>
        <select value={kdBangsalBaru} onChange={(e) => setKdBangsalBaru(e.target.value)} style={inputStyle}>
          <option value="">- Pilih Bangsal -</option>
          {bangsalBelumTroli.map((b) => (
            <option key={b.kode} value={b.kode}>{b.nama}</option>
          ))}
        </select>
      </div>
      <div style={{ minWidth: 220, flex: 1 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Keterangan (opsional)</label>
        <input style={inputStyle} placeholder="mis. Troli dekat nurse station IGD" value={keteranganBaru} onChange={(e) => setKeteranganBaru(e.target.value)} />
      </div>
      <button
        type="submit"
        disabled={savingLokasi}
        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', cursor: savingLokasi ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
      >
        {savingLokasi ? 'Menyimpan...' : 'Tambahkan'}
      </button>
      <button
        type="button"
        onClick={() => setShowTambahLokasi(false)}
        style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
      >
        Batal
      </button>
    </form>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      {lokasiList.length === 0 ? (
        <>
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 12, background: '#f9fafb' }}>
            Belum ada data obat di troli Emergensi
          </div>
          {showTambahLokasi ? tambahLokasiForm : (
            <button
              type="button"
              onClick={() => setShowTambahLokasi(true)}
              style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 999, border: '1px dashed #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              + Tambah Lokasi Troli
            </button>
          )}
        </>
      ) : (
        <>
          {/* Tab lokasi troli — satu tab per lokasi yang sudah ditandai, mis.
              |IGD|OK|ICU|. Tiap tab punya "×" kecil (muncul saat hover) utk
              keluarkan dari daftar troli. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
            {lokasiList.map((l) => {
              const isActive = activeTab === l.kd_bangsal;
              const jumlahDiLokasi = stokItems.filter((it) => it.kd_bangsal === l.kd_bangsal).length;
              return (
                <div
                  key={l.kd_bangsal}
                  className="troli-emergensi-tab"
                  style={{ display: 'flex', alignItems: 'center', borderBottom: isActive ? '2px solid #059669' : '2px solid transparent' }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab(l.kd_bangsal)}
                    style={{
                      padding: '8px 4px 8px 16px', border: 'none', background: 'transparent',
                      color: isActive ? '#059669' : '#6b7280', fontWeight: isActive ? 600 : 400,
                      fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {l.nm_bangsal || l.kd_bangsal} ({jumlahDiLokasi})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHapusLokasi(l)}
                    title="Keluarkan dari daftar troli"
                    className="troli-emergensi-tab-close"
                    style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '4px 12px 4px 2px' }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setShowTambahLokasi((v) => !v)}
              style={{ padding: '6px 14px', marginBottom: 4, marginLeft: 'auto', borderRadius: 4, border: '1px dashed #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}
            >
              + Tambah Lokasi
            </button>
          </div>
          <style>{`
            .troli-emergensi-tab-close { opacity: 0; transition: opacity 0.15s ease; }
            .troli-emergensi-tab:hover .troli-emergensi-tab-close { opacity: 1; }
            .troli-emergensi-tab-close:hover { color: #dc2626 !important; }
          `}</style>

          {showTambahLokasi && tambahLokasiForm}

          <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Barang</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis</th>
                  <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok</th>
                  <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kadaluarsa</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
                ) : stokTerfilter.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Belum ada data obat di troli Emergensi</td></tr>
                ) : (
                  stokTerfilter.map((item, index) => {
                    const sudahKadaluarsa = !!item.kadaluarsa && item.kadaluarsa < todayStr;
                    return (
                      <tr key={`${item.kd_bangsal}-${item.kode_brng}`} style={{ background: item.stok <= 0 ? '#fef2f2' : index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kode_brng}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.nama_brng}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.satuan}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.jenis}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: item.stok <= 0 ? '#dc2626' : '#374151', fontWeight: item.stok <= 0 ? 700 : 400 }}>
                          {item.stok}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: sudahKadaluarsa ? '#dc2626' : '#374151', fontWeight: sudahKadaluarsa ? 700 : 400 }}>
                          {item.kadaluarsa || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
